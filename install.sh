#!/bin/bash
# HelmCode 安装脚本
# 用法:
#   bash install.sh install [--preset java-ddd|minimal] [--project /path/to/project] [--force] [--global-loader]
#   bash install.sh status [--project /path/to/project]
#   bash install.sh update [--preset java-ddd|minimal] [--project /path/to/project] [--global-loader] [--no-self-update]
#   bash install.sh list
#   bash install.sh version
#
# 两种安装方式:
# 1. 本脚本: bash install.sh install --preset java-ddd --project /path/to/project
# 2. Claude Code 中: /helmcode-loader
#
# 安装模式: 复制到项目级 .claude/skills/（项目级安装，helmcode-loader 为全局入口）

set -e

# 确定 HelmCode 源码路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELMCODE_HOME="$SCRIPT_DIR"

# ── Version ──────────────────────────────────────────────

get_helmcode_version() {
  local pkg="$HELMCODE_HOME/package.json"
  if [ -f "$pkg" ]; then
    grep '"version"' "$pkg" | head -1 | sed 's/.*: *"//;s/".*//' 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

# ── Install method detection ─────────────────────────────

detect_install_method() {
  # Check npm global
  if command -v npm &>/dev/null; then
    local npm_prefix
    npm_prefix="$(npm config get prefix 2>/dev/null)" || true
    if [ -n "$npm_prefix" ] && [ -f "$npm_prefix/bin/helmcode" -o -f "$npm_prefix/helmcode.cmd" ]; then
      echo "npm-global"
      return
    fi
  fi

  # Check git clone
  if [ -d "$HELMCODE_HOME/.git" ]; then
    echo "git-clone"
    return
  fi

  # Check npx
  if [ -n "$npm_lifecycle_event" ] && echo "$npm_lifecycle_event" | grep -q "npx"; then
    echo "npx"
    return
  fi

  echo "unknown"
}

# ── Semver comparison ────────────────────────────────────

# Returns: -1 (a < b), 0 (a == b), 1 (a > b)
compare_semver() {
  local a="$1" b="$2"
  # Strip leading 'v' and prerelease suffix
  a="${a#v}"; a="${a%%-*}"
  b="${b#v}"; b="${b%%-*}"

  local a_major a_minor a_patch b_major b_minor b_patch
  IFS='.' read -r a_major a_minor a_patch <<< "$a"
  IFS='.' read -r b_major b_minor b_patch <<< "$b"

  a_major="${a_major:-0}"; a_minor="${a_minor:-0}"; a_patch="${a_patch:-0}"
  b_major="${b_major:-0}"; b_minor="${b_minor:-0}"; b_patch="${b_patch:-0}"

  if [ "$a_major" -gt "$b_major" ]; then echo 1; return
  elif [ "$a_major" -lt "$b_major" ]; then echo -1; return; fi

  if [ "$a_minor" -gt "$b_minor" ]; then echo 1; return
  elif [ "$a_minor" -lt "$b_minor" ]; then echo -1; return; fi

  if [ "$a_patch" -gt "$b_patch" ]; then echo 1; return
  elif [ "$a_patch" -lt "$b_patch" ]; then echo -1; return; fi

  echo 0
}

# ── Version stamp ────────────────────────────────────────

write_version_stamp() {
  local project_dir="$1" version="$2" method="$3" preset="$4"
  local stamp_path="$project_dir/.claude/.helmcode-version"
  mkdir -p "$(dirname "$stamp_path")"
  cat > "$stamp_path" << STAMP_EOF
{
  "version": "$version",
  "installMethod": "$method",
  "preset": "$preset",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
STAMP_EOF
}

read_version_stamp() {
  local project_dir="$1"
  local stamp_path="$project_dir/.claude/.helmcode-version"
  if [ -f "$stamp_path" ]; then
    cat "$stamp_path"
  else
    echo ""
  fi
}

# ── Fetch latest version ─────────────────────────────────

fetch_latest_version() {
  local method="$1"
  local version=""

  if [ "$method" = "git-clone" ]; then
    # Try GitHub releases API first
    version="$(curl -s --max-time 5 -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/wanlihang/helmcode/releases/latest" 2>/dev/null \
      | grep -o '"tag_name":"[^"]*"' | head -1 | sed 's/"tag_name":"//;s/"//' | sed 's/^v//')"

    # Fallback to git ls-remote tags
    if [ -z "$version" ]; then
      version="$(git -C "$HELMCODE_HOME" ls-remote --tags origin 2>/dev/null \
        | grep -o 'refs/tags/v\?[0-9]\+\.[0-9]\+\.[0-9]\+' \
        | sed 's|refs/tags/v\?||' \
        | sort -t. -k1,1n -k2,2n -k3,3n \
        | tail -1)"
    fi
  else
    # npm registry
    version="$(curl -s --max-time 5 "https://registry.npmjs.org/helmcode/latest" 2>/dev/null \
      | grep -o '"version":"[^"]*"' | head -1 | sed 's/"version":"//;s/"//')"
  fi

  echo "${version:-unknown}"
}

# ── Self-update ──────────────────────────────────────────

self_update() {
  local method="$1"

  case "$method" in
    npm-global)
      log "⬆" "Updating via npm: npm update -g helmcode"
      if npm update -g helmcode 2>&1; then
        return 0
      else
        log "⚠" "npm update -g helmcode failed"
        log "ℹ" "You may need sudo: sudo npm update -g helmcode"
        return 1
      fi
      ;;
    npm-local)
      log "⬆" "Updating via npm: npm update helmcode"
      if npm update helmcode 2>&1; then
        return 0
      else
        log "⚠" "npm update helmcode failed"
        return 1
      fi
      ;;
    git-clone)
      local branch
      branch="$(git -C "$HELMCODE_HOME" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
      log "⬆" "Updating via git: git pull origin $branch"
      if git -C "$HELMCODE_HOME" pull origin "$branch" 2>&1; then
        return 0
      else
        log "⚠" "git pull failed"
        log "ℹ" "You may have local changes. Run 'git status' in $HELMCODE_HOME"
        return 1
      fi
      ;;
    npx)
      log "ℹ" "Running via npx — cannot self-update."
      log "ℹ" "Next time use: npx helmcode@latest install"
      return 1
      ;;
    *)
      log "⚠" "Could not determine install method. Manual update options:"
      log " " "  npm update -g helmcode"
      log " " "  git pull  (if cloned from GitHub)"
      log " " "  npx helmcode@latest install"
      return 1
      ;;
  esac
}

# ── Helpers ──────────────────────────────────────────────

log() {
  echo "  $1 $2"
}

header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

phase_header() {
  echo ""
  echo "📦 Phase $1: $2"
  echo "─────────────────────────────────────────"
}

# ── Preset definitions ──────────────────────────────────

JAVA_DDD_SKILLS=("dev-flow" "clarify" "implement" "verify" "analyze" "init-java-ddd")
MINIMAL_SKILLS=("dev-flow" "clarify")

# ── Detect preset ────────────────────────────────────────

detect_preset() {
  local dir="$1"
  if [ -f "$dir/pom.xml" ] || [ -f "$dir/build.gradle" ]; then
    echo "java-ddd"
  else
    echo "minimal"
  fi
}

# ── Install Skills ───────────────────────────────────────

install_skills() {
  local project_dir="$1"
  shift
  local skills=("$@")

  for skill in "${skills[@]}"; do
    local source="$HELMCODE_HOME/core/$skill"
    local target="$project_dir/.claude/skills/$skill"

    if [ ! -d "$source" ]; then
      log "⚠" "$skill 源目录不存在，跳过"
      continue
    fi

    # 整目录复制(SKILL.md + references/ + templates/ + claude-md/ 及未来子目录)。
    # 部分 skill(如 init-java-ddd)依赖随包发布的脚手架模板才能在执行期工作,
    # 只拷 SKILL.md+references/ 会导致运行时找不到模板。
    rm -rf "$target"
    mkdir -p "$(dirname "$target")"
    cp -R "$source" "$target"

    local extras=""
    [ -d "$source/references" ] && extras="$extras references/"
    [ -d "$source/templates" ]  && extras="$extras templates/"
    [ -d "$source/claude-md" ]  && extras="$extras claude-md/"
    if [ -n "$extras" ]; then
      log "✓" "$skill (+$extras)"
    else
      log "✓" "$skill"
    fi
  done
}

# ── Install Standards ────────────────────────────────────

install_standards() {
  local project_dir="$1"
  local preset="$2"

  if [ "$preset" = "minimal" ]; then
    log "ℹ" "Preset 'minimal' 无编码标准"
    return 0
  fi

  local source="$HELMCODE_HOME/standards/$preset"
  local target="$project_dir/.claude/standards"

  if [ ! -d "$source" ]; then
    log "⚠" "Preset '$preset' 不存在，跳过 standards"
    log "ℹ" "可用预设: $(ls "$HELMCODE_HOME/standards/" 2>/dev/null || echo '无')"
    return 0
  fi

  mkdir -p "$target"

  # 复制标准文件
  for file in "$source"/*.md; do
    if [ -f "$file" ]; then
      local filename=$(basename "$file")
      cp "$file" "$target/$filename"
      log "✓" "standards/$filename"
    fi
  done

  # 复制 patterns 目录
  if [ -d "$source/patterns" ]; then
    local patterns_target="$target/patterns"
    mkdir -p "$patterns_target"
    for file in "$source/patterns"/*.md; do
      if [ -f "$file" ]; then
        local filename=$(basename "$file")
        cp "$file" "$patterns_target/$filename"
        log "✓" "standards/patterns/$filename"
      fi
    done
  fi
}

# ── Scan project conventions (java-ddd only) ─────────────

scan_do_annotations() {
  local project_dir="$1"
  local do_files=$(find "$project_dir/app" -name "DO.java" 2>/dev/null | grep -v '/target/')
  if [ -z "$do_files" ]; then
    echo "detected=false"
    return
  fi

  local data_count=0 getter_count=0 plain_count=0 tablename_count=0
  local data_example="" getter_example="" plain_example=""

  for file in $do_files; do
    local content=$(cat "$file")
    if echo "$content" | grep -q "@Data"; then
      data_count=$((data_count + 1))
      [ -z "$data_example" ] && data_example="$file"
    elif echo "$content" | grep -q "@Getter"; then
      getter_count=$((getter_count + 1))
      [ -z "$getter_example" ] && getter_example="$file"
    else
      plain_count=$((plain_count + 1))
      [ -z "$plain_example" ] && plain_example="$file"
    fi
    echo "$content" | grep -q "@TableName" && tablename_count=$((tablename_count + 1))
  done

  local total=$(echo "$do_files" | wc -l | tr -d ' ')
  local dominant="" dominant_count=0 dominant_example=""
  if [ "$data_count" -ge "$getter_count" ] && [ "$data_count" -ge "$plain_count" ]; then
    dominant="@Data" dominant_count=$data_count dominant_example="$data_example"
  elif [ "$getter_count" -ge "$plain_count" ]; then
    dominant="@Getter" dominant_count=$getter_count dominant_example="$getter_example"
  else
    dominant="plain" dominant_count=$plain_count dominant_example="$plain_example"
  fi

  local consistency=$((dominant_count * 100 / total))
  local style=""
  if [ "$dominant" = "@Data" ]; then
    if [ "$tablename_count" -gt $((total / 2)) ]; then
      style="@Data + @TableName (MyBatis-Plus)"
    else
      style="@Data"
    fi
  elif [ "$dominant" = "@Getter" ]; then
    style="@Getter + @Setter"
  else
    style="plain (no Lombok)"
  fi

  echo "detected=true"
  echo "total=$total"
  echo "style=$style"
  echo "consistency=$consistency"
  echo "example=$dominant_example"
}

scan_exception_pattern() {
  local project_dir="$1"
  local java_files=$(find "$project_dir/app" -name "*.java" 2>/dev/null | grep -v '/target/')

  local mycm_count=0 biz_count=0 operation_count=0 runtime_count=0
  local error_code_enum=""

  for file in $java_files; do
    local content=$(cat "$file")
    mycm_count=$((mycm_count + $(echo "$content" | grep -c "throw new MycmBizException" 2>/dev/null || echo 0)))
    biz_count=$((biz_count + $(echo "$content" | grep -c "throw new BizException" 2>/dev/null || echo 0)))
    operation_count=$((operation_count + $(echo "$content" | grep -c "throw new OperationException" 2>/dev/null || echo 0)))
    runtime_count=$((runtime_count + $(echo "$content" | grep -c "throw new RuntimeException" 2>/dev/null || echo 0)))

    if [ -z "$error_code_enum" ]; then
      local enum_match=$(echo "$content" | grep -oP 'throw new \w+\(\K\w+' | head -1)
      if [ -n "$enum_match" ] && [[ ! "$enum_match" =~ ^(new|String|Long|Integer)$ ]]; then
        error_code_enum="$enum_match"
      fi
    fi
  done

  local total=$((mycm_count + biz_count + operation_count + runtime_count))
  if [ "$total" -eq 0 ]; then
    echo "detected=false"
    return
  fi

  local dominant="MycmBizException" dominant_count=$mycm_count
  if [ "$biz_count" -gt "$dominant_count" ]; then dominant="BizException"; dominant_count=$biz_count; fi
  if [ "$operation_count" -gt "$dominant_count" ]; then dominant="OperationException"; dominant_count=$operation_count; fi

  local consistency=$((dominant_count * 100 / total))
  [ -z "$error_code_enum" ] && error_code_enum="ErrorCodeEnum"

  echo "detected=true"
  echo "exception_class=$dominant"
  echo "exception_count=$dominant_count"
  echo "error_code_enum=$error_code_enum"
  echo "consistency=$consistency"
}

scan_facade_pattern() {
  local project_dir="$1"
  local facade_files=$(find "$project_dir/app" -name "FacadeImpl.java" 2>/dev/null | grep -v '/target/')
  if [ -z "$facade_files" ]; then
    echo "detected=false"
    return
  fi

  local rpc_provider=0 sofa_service=0 spring_service=0 biz_template=0 manual=0

  for file in $facade_files; do
    local content=$(cat "$file")
    echo "$content" | grep -q "@RpcProvider" && rpc_provider=$((rpc_provider + 1))
    echo "$content" | grep -q "@SofaService" && sofa_service=$((sofa_service + 1))
    echo "$content" | grep -q "@Service" && ! echo "$content" | grep -q "@RpcProvider\|@SofaService" && spring_service=$((spring_service + 1))
    if echo "$content" | grep -q "bizTemplate.doProcess\|BizTemplate"; then
      biz_template=$((biz_template + 1))
    elif echo "$content" | grep -q "result.setSuccess\|Result<"; then
      manual=$((manual + 1))
    fi
  done

  local total=$(echo "$facade_files" | wc -l | tr -d ' ')
  local rpc_annotation="SofaService"
  [ "$rpc_provider" -ge "$sofa_service" ] && rpc_annotation="RpcProvider"
  local result_style="manual"
  [ "$biz_template" -ge "$manual" ] && result_style="BizTemplate"

  local rpc_consistency=0
  if [ "$total" -gt 0 ]; then
    local rpc_max=$rpc_provider
    [ "$sofa_service" -gt "$rpc_max" ] && rpc_max=$sofa_service
    [ "$spring_service" -gt "$rpc_max" ] && rpc_max=$spring_service
    rpc_consistency=$((rpc_max * 100 / total))
  fi

  echo "detected=true"
  echo "total=$total"
  echo "rpc_annotation=@$rpc_annotation"
  echo "rpc_consistency=$rpc_consistency"
  echo "result_style=$result_style"
}

scan_mapstruct() {
  local project_dir="$1"
  local convert_files=$(find "$project_dir/app" \( -name "Convert.java" -o -name "Converter.java" \) 2>/dev/null | grep -v '/target/')

  if [ -z "$convert_files" ]; then
    echo "detected=true"
    echo "usage=none"
    echo "total=0"
    return
  fi

  local mapstruct_count=0 hand_written=0 instance_field=""
  for file in $convert_files; do
    local content=$(cat "$file")
    if echo "$content" | grep -q "@Mapper" && echo "$content" | grep -q "Mappers.getMapper"; then
      mapstruct_count=$((mapstruct_count + 1))
      if [ -z "$instance_field" ]; then
        instance_field=$(echo "$content" | grep -oP '\w+(?=\s*=\s*Mappers\.getMapper)' | head -1)
      fi
    elif ! echo "$content" | grep -q "@Mapper"; then
      hand_written=$((hand_written + 1))
    fi
  done

  local total=$(echo "$convert_files" | wc -l | tr -d ' ')
  echo "detected=true"
  echo "usage=$([ "$mapstruct_count" -gt 0 ] && echo "mapstruct" || echo "handwritten")"
  echo "total=$total"
  echo "mapstruct_count=$mapstruct_count"
  echo "hand_written_count=$hand_written"
  echo "instance_field=$instance_field"
}

scan_persistence() {
  local project_dir="$1"
  local xml_count=$(find "$project_dir/app" -name "Mapper.xml" 2>/dev/null | grep -v '/target/' | wc -l | tr -d ' ')
  local tablename_count=$(find "$project_dir/app" -name "DO.java" 2>/dev/null | grep -v '/target/' | xargs grep -l "@TableName" 2>/dev/null | wc -l | tr -d ' ')
  local basemapper_count=$(find "$project_dir/app" -name "Mapper.java" 2>/dev/null | grep -v '/target/' | xargs grep -l "BaseMapper" 2>/dev/null | wc -l | tr -d ' ')

  local framework="unknown"
  if [ "$tablename_count" -gt 3 ] || [ "$basemapper_count" -gt 0 ]; then
    framework="mybatis-plus"
  elif [ "$xml_count" -gt 0 ]; then
    framework="mybatis-xml"
  fi

  echo "detected=true"
  echo "framework=$framework"
  echo "xml_mapper_count=$xml_count"
  echo "mybatis_plus_count=$tablename_count"
}

generate_project_conventions() {
  local project_dir="$1"
  local output_file="$project_dir/.claude/standards/project-conventions.md"

  mkdir -p "$(dirname "$output_file")"

  # Run scans
  eval "$(scan_do_annotations "$project_dir")"
  local do_detected="${detected:-false}" do_style="${style:-}" do_consistency="${consistency:-0}" do_example="${example:-}" do_total="${total:-0}"

  eval "$(scan_exception_pattern "$project_dir")"
  local ex_detected="${detected:-false}" ex_class="${exception_class:-}" ex_enum="${error_code_enum:-}" ex_consistency="${consistency:-0}"

  eval "$(scan_facade_pattern "$project_dir")"
  local facade_detected="${detected:-false}" facade_rpc="${rpc_annotation:-}" facade_rpc_consistency="${rpc_consistency:-0}" facade_result="${result_style:-}"

  eval "$(scan_mapstruct "$project_dir")"
  local convert_detected="${detected:-false}" convert_usage="${usage:-none}" convert_field="${instance_field:-}" convert_mapstruct="${mapstruct_count:-0}" convert_hand="${hand_written_count:-0}"

  eval "$(scan_persistence "$project_dir")"
  local persist_detected="${detected:-false}" persist_framework="${framework:-unknown}"

  confidence_icon() {
    if [ "$1" -ge 90 ]; then echo "✅"; elif [ "$1" -ge 60 ]; then echo "⚠️"; else echo "❌"; fi
  }

  cat > "$output_file" << CONV_EOF
# 项目约定 — 自动检测

> 由 helmcode install 自动扫描项目代码生成。
> AI 生成代码时以本文件为准。

CONV_EOF

  if [ "$do_detected" = "true" ]; then
    local icon=$(confidence_icon "$do_consistency")
    cat >> "$output_file" << DO_EOF

## DO 注解风格

- **检测结果**: $do_style
- **一致性**: $icon $do_consistency% ($do_total 个 DO 文件)
- **规则**: DO 不继承基类，审计字段 (id, gmtCreate, gmtModified, creator, modifier) 内联声明
- **示例**: $do_example

DO_EOF
  fi

  if [ "$ex_detected" = "true" ]; then
    local icon=$(confidence_icon "$ex_consistency")
    cat >> "$output_file" << EX_EOF

## 异常类与错误码

- **异常类**: $ex_class
- **错误码枚举**: $ex_enum
- **构造模式**: throw new $ex_class($ex_enum.XXX, "message")
- **一致性**: $icon $ex_consistency%

EX_EOF
  fi

  if [ "$facade_detected" = "true" ]; then
    local icon=$(confidence_icon "$facade_rpc_consistency")
    cat >> "$output_file" << FACADE_EOF

## Facade 模式

- **RPC 发布注解**: $facade_rpc
- **注解一致性**: $icon $facade_rpc_consistency%
- **Result 构建**: $facade_result
- **拦截注解**: @FacadeIntercept(loggerName = ...)

FACADE_EOF
  fi

  if [ "$convert_detected" = "true" ] && [ "$convert_usage" != "none" ]; then
    local usage_label=$([ "$convert_usage" = "mapstruct" ] && echo "MapStruct" || echo "手写转换")
    cat >> "$output_file" << CONVERT_EOF

## Convert 模式

- **使用方式**: $usage_label
CONVERT_EOF
    if [ "$convert_usage" = "mapstruct" ] && [ -n "$convert_field" ]; then
      cat >> "$output_file" << MAPSTRUCT_EOF
- **单例字段名**: $convert_field
- **调用方式**: XxxConvert.$convert_field.toEntity(doObj)
- **注解**: @Mapper（无 componentModel）
MAPSTRUCT_EOF
    fi
    cat >> "$output_file" << CONVERT_COUNT_EOF
- **MapStruct 文件数**: $convert_mapstruct
- **手写文件数**: $convert_hand

CONVERT_COUNT_EOF
  fi

  if [ "$persist_detected" = "true" ]; then
    local desc=""
    if [ "$persist_framework" = "mybatis-xml" ]; then
      desc="使用 MyBatis XML Mapper"
    elif [ "$persist_framework" = "mybatis-plus" ]; then
      desc="使用 MyBatis-Plus，DO 使用 @TableName 注解，Mapper 继承 BaseMapper"
    fi
    cat >> "$output_file" << PERSIST_EOF

## 持久层框架

- **框架**: $persist_framework
${desc:+- **说明**: $desc}

PERSIST_EOF
  fi

  cat >> "$output_file" << FOOTER_EOF
---
*此文件由 helmcode install 自动生成，可根据需要手动修改。*
FOOTER_EOF

  log "✓" "project-conventions.md 生成完毕"

  # Print summary
  echo ""
  log "ℹ" "约定扫描结果:"
  if [ "$do_detected" = "true" ]; then log " " "DO: $do_style ($do_consistency%)"; fi
  if [ "$facade_detected" = "true" ]; then log " " "Facade: $facade_rpc, Result: $facade_result"; fi
  if [ "$convert_detected" = "true" ]; then
    if [ "$convert_usage" = "mapstruct" ]; then
      log " " "Convert: MapStruct $convert_field"
    else
      log " " "Convert: $convert_usage"
    fi
  fi
}

# ── Create project directories ───────────────────────────

create_project_dirs() {
  local project_dir="$1"

  local dirs=(
    ".claude/contracts"
    ".claude/briefs"
    ".claude/judgment-logs"
  )

  for dir in "${dirs[@]}"; do
    local full_path="$project_dir/$dir"
    if [ -d "$full_path" ]; then
      log "✓" "$dir (已存在)"
    else
      mkdir -p "$full_path"
      log "✓" "$dir (已创建)"
    fi
  done

  # 初始化 registry.md
  local registry="$project_dir/.claude/contracts/registry.md"
  if [ -f "$registry" ]; then
    log "✓" "registry.md (已存在)"
  else
    cat > "$registry" << 'EOF'
# Feature 注册表

| Feature ID | 名称 | 状态 | 行为契约 | 判断日志 | 创建时间 | 更新时间 |
|------------|------|------|---------|---------|---------|---------|
EOF
    log "✓" "registry.md (已创建)"
  fi

  # 安装 verify 脚本
  local scripts_source="$HELMCODE_HOME/scripts"
  local scripts_target="$project_dir/.claude/scripts"
  if [ -d "$scripts_source" ]; then
    mkdir -p "$scripts_target"
    for file in "$scripts_source"/*.mjs; do
      if [ -f "$file" ]; then
        cp "$file" "$scripts_target/"
      fi
    done
    log "✓" ".claude/scripts/ (verify 脚本已安装)"
  fi

  # 安装 commands
  local commands_source="$HELMCODE_HOME/commands"
  local commands_target="$project_dir/.claude/commands"
  if [ -d "$commands_source" ]; then
    mkdir -p "$commands_target"
    for file in "$commands_source"/*.md; do
      if [ -f "$file" ]; then
        cp "$file" "$commands_target/"
      fi
    done
    log "✓" ".claude/commands/ (checkpoint, state)"
  fi
}

# ── Configure CLAUDE.md ──────────────────────────────────

configure_claude_md() {
  local project_dir="$1"

  local claude_md="$project_dir/CLAUDE.md"

  local helmcode_section='
# HelmCode 工作流

主流程: /dev-flow (clarify → /goal → checkpoint)
单独使用: /clarify, /implement, /verify, /analyze, /checkpoint

## 编码标准
- 编码标准: .claude/standards/standards.md
- 项目约定: .claude/standards/project-conventions.md（覆盖默认值）
- 审查规则: .claude/standards/review-rules.md
- 测试标准: .claude/standards/test-standards.md
- 代码模式: .claude/standards/patterns/

## 目录约定
- 行为契约: .claude/contracts/
- 项目简报: .claude/briefs/ (不参与代码生成)
- 判断日志: .claude/judgment-logs/
- Feature 注册: .claude/contracts/registry.md
'

  if [ -f "$claude_md" ]; then
    if grep -q "HelmCode" "$claude_md" 2>/dev/null; then
      log "⚠" "CLAUDE.md 已包含 HelmCode 配置，跳过"
    else
      echo "" >> "$claude_md"
      echo "$helmcode_section" >> "$claude_md"
      log "✓" "CLAUDE.md (已追加 HelmCode 配置)"
    fi
  else
    # 检测技术栈
    local tech_stack="unknown"
    if [ -f "$project_dir/pom.xml" ]; then
      tech_stack="Java/Spring Boot DDD"
    elif [ -f "$project_dir/package.json" ]; then
      tech_stack="Node.js"
    fi

    cat > "$claude_md" << CLAUDEMD_EOF
# 项目约束

## 技术栈
$tech_stack
$helmcode_section
CLAUDEMD_EOF
    log "✓" "CLAUDE.md (已创建)"
  fi
}

# ── Install global loader ────────────────────────────────

install_global_loader() {
  local global_skills_dir="$HOME/.claude/skills"
  local loader_target="$global_skills_dir/helmcode-loader"
  local loader_source="$HELMCODE_HOME/loader"

  mkdir -p "$global_skills_dir"

  # Remove existing symlink or directory
  if [ -L "$loader_target" ] || [ -d "$loader_target" ]; then
    rm -rf "$loader_target"
  fi

  ln -s "$loader_source" "$loader_target"
  log "✓" "全局 loader: ~/.claude/skills/helmcode-loader"
}

# ── Install command ──────────────────────────────────────

cmd_install() {
  local preset="$1"
  local project_dir="$2"
  local force="$3"
  local global_loader="$4"
  local quiet="$5"
  local phase_offset="$6"

  if [ -z "$project_dir" ]; then
    project_dir="$(pwd)"
  fi
  project_dir="$(cd "$project_dir" && pwd)"

  # 自动检测 preset
  if [ -z "$preset" ]; then
    preset=$(detect_preset "$project_dir")
  fi

  # 检查 HelmCode 源码完整性
  if [ ! -d "$HELMCODE_HOME/core" ] || [ ! -d "$HELMCODE_HOME/core/dev-flow" ]; then
    echo "❌ 错误：找不到 HelmCode 核心文件"
    echo "   预期路径: $HELMCODE_HOME/core/"
    echo "   请确认在 HelmCode 根目录运行此脚本"
    exit 1
  fi

  # 确定 skills 列表
  local skills=()
  if [ "$preset" = "java-ddd" ]; then
    skills=("${JAVA_DDD_SKILLS[@]}")
  elif [ "$preset" = "minimal" ]; then
    skills=("${MINIMAL_SKILLS[@]}")
  else
    echo "  ⚠ 未知 preset: $preset，使用 minimal"
    skills=("${MINIMAL_SKILLS[@]}")
    preset="minimal"
  fi

  # 确认安装
  if [ "$force" = false ]; then
    header "HelmCode 安装"
    echo ""
    echo "  项目路径: $project_dir"
    echo "  技术栈:   $preset"
    echo ""
    echo "  将安装以下内容:"
    echo "  - Skills: ${skills[*]}"
    if [ "$preset" = "java-ddd" ]; then
      echo "  - Standards: standards.md, review-rules.md, test-standards.md, patterns/"
      echo "  - 项目约定扫描: DO 注解、异常类、Facade 模式、MapStruct 等"
    fi
    echo "  - 目录: .claude/contracts/, .claude/briefs/, .claude/judgment-logs/"
    echo "  - 脚本: .claude/scripts/ (verify 脚本)"
    echo "  - 命令: .claude/commands/ (checkpoint, state)"
    echo "  - 配置: CLAUDE.md (追加 HelmCode 配置)"
    if [ "$global_loader" = true ]; then
      echo "  - 全局 loader: ~/.claude/skills/helmcode-loader"
    fi
    echo ""
    echo "  使用 --force 跳过确认"
    echo ""
    read -p "  确认安装? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "  已取消"
      exit 0
    fi
  fi

  local current_version
  current_version="$(get_helmcode_version)"
  local install_method
  install_method="$(detect_install_method)"

  if [ "$quiet" != "true" ]; then
    header "HelmCode 安装中..."
    log "ℹ" "Source version: v${current_version} (${install_method})"
  fi

  # Phase numbering: when called from update, continue from the offset
  [ -z "$phase_offset" ] && phase_offset=0

  # Phase 1: 安装 Skills
  phase_header $((phase_offset + 1)) "安装 Skills 到 .claude/skills/"
  install_skills "$project_dir" "${skills[@]}"

  # Phase 2: 安装 Standards
  phase_header $((phase_offset + 2)) "安装编码标准 (preset: $preset)"
  install_standards "$project_dir" "$preset"

  # Phase 3: 扫描项目约定 (仅 java-ddd)
  if [ "$preset" = "java-ddd" ] && [ -d "$project_dir/app" ]; then
    phase_header $((phase_offset + 3)) "扫描项目约定"
    generate_project_conventions "$project_dir"
  elif [ "$preset" = "java-ddd" ]; then
    phase_header $((phase_offset + 3)) "扫描项目约定"
    log "ℹ" "未找到 app/ 目录，跳过项目约定扫描"
  fi

  # Phase 4: 创建项目目录
  phase_header $((phase_offset + 4)) "创建项目目录"
  create_project_dirs "$project_dir"

  # Phase 5: 配置 CLAUDE.md
  phase_header $((phase_offset + 5)) "配置 CLAUDE.md"
  configure_claude_md "$project_dir"

  # Phase 6: 全局 loader (可选)
  if [ "$global_loader" = true ]; then
    phase_header $((phase_offset + 6)) "安装全局 Loader"
    install_global_loader
  fi

  # Write version stamp
  local new_version
  new_version="$(get_helmcode_version)"
  local new_method
  new_method="$(detect_install_method)"
  write_version_stamp "$project_dir" "$new_version" "$new_method" "$preset"

  # 完成报告 (skip when called from update — update prints its own summary)
  if [ "$quiet" != "true" ]; then
    local skill_count=${#skills[@]}
    local standards_count=0
    if [ -d "$project_dir/.claude/standards" ]; then
      standards_count=$(find "$project_dir/.claude/standards" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    fi

    header "HelmCode 安装完成！"
    echo ""
    echo "  📦 已安装:"
    echo "     Version:   v${new_version}"
    echo "     Skills:    ${skill_count} 个"
    echo "     Standards: ${standards_count} 个文件"
    echo ""
    echo "  🚀 使用方式:"
    echo "     /dev-flow    — Goal 驱动工作流 (clarify → /goal → checkpoint)"
    echo "     /clarify     — 拆解需求，生成行为契约"
    echo "     /checkpoint  — 审查判断日志"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  fi
}

# ── Status command ───────────────────────────────────────

cmd_status() {
  local project_dir="$1"
  if [ -z "$project_dir" ]; then
    project_dir="$(pwd)"
  fi

  if [ ! -d "$project_dir" ]; then
    header "HelmCode 状态"
    log "❌" "项目目录不存在: $project_dir"
    return 1
  fi

  project_dir="$(cd "$project_dir" && pwd)"

  local claude_dir="$project_dir/.claude"
  local skills_dir="$claude_dir/skills"
  local standards_dir="$claude_dir/standards"

  local current_version
  current_version="$(get_helmcode_version)"
  local install_method
  install_method="$(detect_install_method)"

  header "HelmCode 状态"
  echo "  Source:      $HELMCODE_HOME"
  echo "  Install:    $install_method"
  echo "  Version:    v${current_version}"

  # Read version stamp
  local stamp_content
  stamp_content="$(read_version_stamp "$project_dir")"
  if [ -n "$stamp_content" ]; then
    local stamp_version stamp_preset stamp_date
    stamp_version="$(echo "$stamp_content" | grep -o '"version": *"[^"]*"' | sed 's/"version": *"//;s/"//')"
    stamp_preset="$(echo "$stamp_content" | grep -o '"preset": *"[^"]*"' | sed 's/"preset": *"//;s/"//')"
    stamp_date="$(echo "$stamp_content" | grep -o '"installedAt": *"[^"]*"' | sed 's/"installedAt": *"//;s/"//')"
    if [ -n "$stamp_version" ]; then
      local display_date=""
      if [ -n "$stamp_date" ]; then
        display_date="$(echo "$stamp_date" | cut -dT -f1)"
      fi
      echo "  Installed:  v${stamp_version} (${stamp_preset}${display_date:+, ${display_date}})"
    fi
  else
    echo "  Installed:  unknown (installed before version tracking)"
  fi

  echo "  Project:    $project_dir"
  echo ""

  if [ ! -d "$claude_dir" ]; then
    log "⚠" ".claude/ 目录不存在"
    log "ℹ" "运行 helmcode install 安装"
    return
  fi

  # Check for updates
  local latest_version
  latest_version="$(fetch_latest_version "$install_method")"
  if [ "$latest_version" != "unknown" ] && [ -n "$latest_version" ]; then
    local cmp
    cmp="$(compare_semver "$current_version" "$latest_version")"
    if [ "$cmp" = "-1" ]; then
      log "⬆" "Update available: v${current_version} → v${latest_version} (run: helmcode update)"
    else
      log "✓" "Up to date (v${current_version})"
    fi
  else
    log "ℹ" "Could not check for updates (offline or registry unavailable)"
  fi
  echo ""

  # Check skills
  if [ -d "$skills_dir" ]; then
    local skills=""
    for d in "$skills_dir"/*/; do
      [ -f "$d/SKILL.md" ] && skills="$skills $(basename "$d")"
    done
    if [ -n "$skills" ]; then
      log "✓" "Skills:${skills}"
    else
      log "⚠" "未安装任何 skill"
    fi
  else
    log "⚠" "未安装 skills"
  fi

  # Check standards
  if [ -d "$standards_dir" ]; then
    local files=""
    for f in "$standards_dir"/*.md; do
      [ -f "$f" ] && files="$files $(basename "$f")"
    done
    local has_patterns=""
    [ -d "$standards_dir/patterns" ] && has_patterns=" + patterns/"
    if [ -n "$files" ]; then
      log "✓" "Standards:${files}${has_patterns}"
    else
      log "⚠" "standards 目录为空"
    fi
  else
    log "⚠" "未安装 standards"
  fi

  # Check directories
  for dir in contracts briefs judgment-logs scripts commands; do
    if [ -d "$claude_dir/$dir" ]; then
      log "✓" ".claude/$dir/"
    else
      log "⚠" ".claude/$dir/ 不存在"
    fi
  done

  # Check CLAUDE.md
  local claude_md="$project_dir/CLAUDE.md"
  if [ -f "$claude_md" ]; then
    if grep -q "HelmCode" "$claude_md" 2>/dev/null; then
      log "✓" "CLAUDE.md 包含 HelmCode 配置"
    else
      log "⚠" "CLAUDE.md 缺少 HelmCode 配置"
    fi
  else
    log "⚠" "CLAUDE.md 不存在"
  fi

  # Check global loader
  local global_loader="$HOME/.claude/skills/helmcode-loader"
  if [ -L "$global_loader" ] || [ -d "$global_loader" ]; then
    log "✓" "全局 helmcode-loader 已安装"
  else
    log "ℹ" "全局 helmcode-loader 未安装 (可选)"
  fi
}

# ── List command ─────────────────────────────────────────

cmd_list() {
  local current_version
  current_version="$(get_helmcode_version)"
  local install_method
  install_method="$(detect_install_method)"

  header "HelmCode 可用 Preset (v${current_version}, ${install_method})"
  echo ""
  echo "  java-ddd:"
  echo "    Skills:    ${JAVA_DDD_SKILLS[*]}"
  echo "    Standards: standards.md, review-rules.md, test-standards.md, patterns/"
  echo "    扫描:     DO 注解、异常类、Facade 模式、MapStruct 等"
  echo ""
  echo "  minimal:"
  echo "    Skills:    ${MINIMAL_SKILLS[*]}"
  echo "    Standards: 无"
  echo ""
}

# ── Version command ──────────────────────────────────────

cmd_version() {
  local v
  v="$(get_helmcode_version)"
  local method
  method="$(detect_install_method)"

  echo "HelmCode v${v}"
  echo "  Install method: ${method}"
  echo "  Source path:    ${HELMCODE_HOME}"
  echo "  Node.js:        $(node --version 2>/dev/null || echo 'N/A')"
}

# ── Update command ───────────────────────────────────────

cmd_update() {
  local preset="$1"
  local project_dir="$2"
  local global_loader="$3"
  local no_self_update="$4"

  if [ -z "$project_dir" ]; then
    project_dir="$(pwd)"
  fi

  if [ ! -d "$project_dir" ]; then
    log "❌" "项目目录不存在: $project_dir"
    return 1
  fi

  project_dir="$(cd "$project_dir" && pwd)"

  if [ -z "$preset" ]; then
    preset=$(detect_preset "$project_dir")
  fi

  local current_version
  current_version="$(get_helmcode_version)"
  local install_method
  install_method="$(detect_install_method)"

  header "HelmCode 更新"
  echo "  Source:      $HELMCODE_HOME"
  echo "  Install:    $install_method"
  echo "  Version:    v${current_version}"
  echo "  Project:    $project_dir"
  echo ""

  # Step 1: Self-update (pull latest source)
  if [ "$no_self_update" != "true" ]; then
    phase_header 1 "检查更新"

    local latest_version
    latest_version="$(fetch_latest_version "$install_method")"

    if [ "$latest_version" = "unknown" ] || [ -z "$latest_version" ]; then
      log "⚠" "无法检查更新（网络不可达或注册表不可用）"
      log "ℹ" "从当前源重新安装项目文件..."
    else
      local cmp
      cmp="$(compare_semver "$current_version" "$latest_version")"

      if [ "$cmp" = "-1" ]; then
        log "⬆" "新版本可用: v${current_version} → v${latest_version}"
        log "ℹ" "正在通过 ${install_method} 更新源码..."

        if self_update "$install_method"; then
          local new_version
          new_version="$(get_helmcode_version)"
          log "✓" "源码已更新: v${current_version} → v${new_version}"
        else
          log "⚠" "源码更新失败，从当前版本 v${current_version} 重新安装"
        fi
      else
        log "✓" "已是最新版本 (v${current_version})"
        log "ℹ" "重新安装项目文件..."
      fi
    fi
  else
    phase_header 1 "自更新 (已跳过)"
    log "ℹ" "跳过源码更新 (--no-self-update)"
    log "ℹ" "从当前源重新安装项目文件..."
  fi

  # Step 2: Reinstall to project (phase numbers continue from 2)
  phase_header 2 "重新安装项目文件"
  cmd_install "$preset" "$project_dir" "true" "$global_loader" "true" "2"

  # Summary
  local new_version
  new_version="$(get_helmcode_version)"
  header "HelmCode 更新完成！"
  echo ""
  echo "  Version:   v${new_version}"
  echo "  Preset:    ${preset}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ── Main ─────────────────────────────────────────────────

COMMAND=""
PRESET=""
PROJECT_DIR=""
FORCE=false
GLOBAL_LOADER=false
NO_SELF_UPDATE=false

# Parse command and options
if [ $# -eq 0 ]; then
  # No args: default to install with auto-detect
  cmd_install "" "" "false" "false" "false" "0"
  exit 0
fi

# First arg might be a command
case "$1" in
  install|status|update|list|version)
    COMMAND="$1"
    shift
    ;;
  --*|-*)
    # Option without command — treat as install
    COMMAND="install"
    ;;
  *)
    echo "未知命令: $1"
    echo "可用命令: install, status, update, list, version"
    echo "运行 bash install.sh --help 查看帮助"
    exit 1
    ;;
esac

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --preset)
      PRESET="$2"
      shift 2
      ;;
    --project)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --global-loader)
      GLOBAL_LOADER=true
      shift
      ;;
    --no-self-update)
      NO_SELF_UPDATE=true
      shift
      ;;
    --version|-v)
      cmd_version
      exit 0
      ;;
    --help|-h)
      echo "HelmCode — AI编程工作流: clarify → /goal → checkpoint"
      echo ""
      echo "用法: helmcode <command> [options]"
      echo ""
      echo "Commands:"
      echo "  install    安装 HelmCode 到项目 (默认命令)"
      echo "  status     显示已安装状态和版本信息"
      echo "  update     拉取最新版本并重新安装项目文件"
      echo "  list       列出可用 preset 和 skills"
      echo "  version    显示 HelmCode 版本和安装信息"
      echo ""
      echo "Options:"
      echo "  --preset <name>          Preset: java-ddd | minimal (自动检测)"
      echo "  --project <path>         目标项目目录 (默认: 当前目录)"
      echo "  --force                  跳过确认"
      echo "  --global-loader          同时安装全局 helmcode-loader skill"
      echo "  --no-self-update         跳过源码更新，仅重新安装项目文件"
      echo "  --version, -v            显示版本"
      echo "  --help, -h               显示帮助"
      echo ""
      echo "示例:"
      echo "  helmcode install                                    # 自动检测，安装到当前目录"
      echo "  helmcode install --preset java-ddd                  # Java DDD 全量"
      echo "  helmcode install --project ~/my-project             # 指定项目目录"
      echo "  helmcode install --global-loader                    # 同时安装全局 loader"
      echo "  helmcode status                                     # 查看安装状态和版本"
      echo "  helmcode update                                     # 拉取最新版本并重新安装"
      echo "  helmcode update --no-self-update                    # 仅从当前源重新安装"
      echo "  helmcode version                                    # 显示版本信息"
      echo "  helmcode list                                       # 列出可用 preset"
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

# Execute command
case "$COMMAND" in
  install)
    cmd_install "$PRESET" "$PROJECT_DIR" "$FORCE" "$GLOBAL_LOADER"
    ;;
  status)
    cmd_status "$PROJECT_DIR"
    ;;
  update)
    cmd_update "$PRESET" "$PROJECT_DIR" "$GLOBAL_LOADER" "$NO_SELF_UPDATE"
    ;;
  list)
    cmd_list
    ;;
  version)
    cmd_version
    ;;
esac
