#!/bin/bash
# HelmCode 安装脚本
# 用法: bash install.sh [--preset java-ddd|minimal] [--project /path/to/project] [--force]
#
# 两种安装方式:
# 1. 本脚本: bash install.sh --preset java-ddd --project /path/to/project
# 2. Claude Code 中: /helmcode-loader
#
# 安装模式: 复制到项目级 .claude/skills/（项目级安装，helmcode-loader 为全局入口）

set -e

# 确定 HelmCode 源码路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELMCODE_HOME="$SCRIPT_DIR"

# 默认参数
PRESET=""
PROJECT_DIR=""
FORCE=false

# 解析参数
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
    --help|-h)
      echo "HelmCode 安装脚本"
      echo ""
      echo "用法: bash install.sh [选项]"
      echo ""
      echo "选项:"
      echo "  --preset java-ddd|minimal  技术栈预设"
      echo "  --project /path/to/project 目标项目目录 (默认: 当前目录)"
      echo "  --force                    跳过确认"
      echo "  --help                     显示帮助"
      echo ""
      echo "示例:"
      echo "  bash install.sh                          # 自动检测，安装到当前目录"
      echo "  bash install.sh --preset java-ddd        # Java DDD 全量"
      echo "  bash install.sh --project ~/my-project   # 指定项目目录"
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

if [ -z "$PROJECT_DIR" ]; then
  PROJECT_DIR="$(pwd)"
fi

# 自动检测 preset
if [ -z "$PRESET" ]; then
  if [ -f "$PROJECT_DIR/pom.xml" ] || [ -f "$PROJECT_DIR/build.gradle" ]; then
    PRESET="java-ddd"
  else
    PRESET="minimal"
  fi
fi

# 检查 HelmCode 源码完整性
if [ ! -d "$HELMCODE_HOME/core" ] || [ ! -d "$HELMCODE_HOME/core/dev-flow" ]; then
  echo "❌ 错误：找不到 HelmCode 核心文件"
  echo "   预期路径: $HELMCODE_HOME/core/"
  echo "   请确认在 HelmCode 根目录运行此脚本"
  exit 1
fi

# 确认安装
if [ "$FORCE" = false ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  HelmCode 安装"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  项目路径: $PROJECT_DIR"
  echo "  技术栈:   $PRESET"
  echo ""
  echo "  将安装以下内容:"
  echo "  - Skills: $(if [ "$PRESET" = "java-ddd" ]; then echo "dev-flow, clarify, implement, verify, analyze"; else echo "dev-flow, clarify"; fi)"
  if [ "$PRESET" = "java-ddd" ]; then
    echo "  - Standards: standards.md, review-rules.md, test-standards.md, patterns/"
  fi
  echo "  - 目录: .claude/contracts/, .claude/briefs/, .claude/judgment-logs/"
  echo "  - 配置: CLAUDE.md (追加 HelmCode 配置)"
  echo ""
  read -p "  确认安装? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  已取消"
    exit 0
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HelmCode 安装中..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ===== Phase 1: 安装 Skills =====
echo ""
echo "📦 Phase 1: 安装 Skills 到 .claude/skills/"
echo "─────────────────────────────────────────"

if [ "$PRESET" = "java-ddd" ]; then
  SKILLS=("dev-flow" "clarify" "implement" "verify" "analyze")
elif [ "$PRESET" = "minimal" ]; then
  SKILLS=("dev-flow" "clarify")
else
  echo "  ⚠ 未知 preset: $PRESET，使用 minimal"
  SKILLS=("dev-flow" "clarify")
fi

for skill in "${SKILLS[@]}"; do
  SOURCE="$HELMCODE_HOME/core/$skill"
  TARGET="$PROJECT_DIR/.claude/skills/$skill"

  if [ ! -d "$SOURCE" ]; then
    echo "  ⚠ $skill 源目录不存在，跳过"
    continue
  fi

  # 创建目标目录
  mkdir -p "$TARGET"

  # 复制 SKILL.md
  cp "$SOURCE/SKILL.md" "$TARGET/SKILL.md"

  # 复制 references/（如果存在）
  if [ -d "$SOURCE/references" ]; then
    cp -r "$SOURCE/references" "$TARGET/"
  fi

  echo "  ✓ $skill $(if [ -d "$SOURCE/references" ]; then echo "(+ references/)"; fi)"
done

# ===== Phase 2: 安装 Standards =====
echo ""
echo "📋 Phase 2: 安装编码标准 (preset: $PRESET)"
echo "─────────────────────────────────────────"

STANDARDS_SOURCE="$HELMCODE_HOME/standards/$PRESET"
STANDARDS_TARGET="$PROJECT_DIR/.claude/standards"

if [ ! -d "$STANDARDS_SOURCE" ]; then
  echo "  ⚠ Preset '$PRESET' 不存在，跳过 standards"
  echo "  可用预设: $(ls "$HELMCODE_HOME/standards/" 2>/dev/null || echo '无')"
else
  mkdir -p "$STANDARDS_TARGET"

  # 复制标准文件
  for file in "$STANDARDS_SOURCE"/*.md; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      cp "$file" "$STANDARDS_TARGET/$filename"
      echo "  ✓ standards/$filename"
    fi
  done

  # 复制 patterns 目录
  if [ -d "$STANDARDS_SOURCE/patterns" ]; then
    PATTERNS_TARGET="$STANDARDS_TARGET/patterns"
    mkdir -p "$PATTERNS_TARGET"
    for file in "$STANDARDS_SOURCE/patterns"/*.md; do
      if [ -f "$file" ]; then
        filename=$(basename "$file")
        cp "$file" "$PATTERNS_TARGET/$filename"
        echo "  ✓ standards/patterns/$filename"
      fi
    done
  fi
fi

# ===== Phase 3: 创建项目目录 =====
echo ""
echo "📁 Phase 3: 创建项目目录"
echo "─────────────────────────────────────────"

DIRS=(
  ".claude/contracts"
  ".claude/briefs"
  ".claude/judgment-logs"
)

for dir in "${DIRS[@]}"; do
  FULL_PATH="$PROJECT_DIR/$dir"
  if [ -d "$FULL_PATH" ]; then
    echo "  ✓ $dir (已存在)"
  else
    mkdir -p "$FULL_PATH"
    echo "  ✓ $dir (已创建)"
  fi
done

# 初始化 registry.md
REGISTRY="$PROJECT_DIR/.claude/contracts/registry.md"
if [ -f "$REGISTRY" ]; then
  echo "  ✓ registry.md (已存在)"
else
  cat > "$REGISTRY" << 'EOF'
# Feature 注册表

| Feature ID | 名称 | 状态 | 行为契约 | 判断日志 | 创建时间 | 更新时间 |
|------------|------|------|---------|---------|---------|---------|
EOF
  echo "  ✓ registry.md (已创建)"
fi

# ===== Phase 4: 配置 CLAUDE.md =====
echo ""
echo "⚙️  Phase 4: 配置 CLAUDE.md"
echo "─────────────────────────────────────────"

CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"

# 检测技术栈
TECH_STACK="unknown"
if [ -f "$PROJECT_DIR/pom.xml" ]; then
  TECH_STACK="Java/Spring Boot DDD"
elif [ -f "$PROJECT_DIR/package.json" ]; then
  TECH_STACK="Node.js"
fi

CLAUDE_MD_HELMCODE="
# HelmCode 工作流

主流程: /dev-flow (clarify → implement → verify)
单独使用: /clarify, /implement, /verify, /analyze

## 编码标准
- 编码标准: .claude/standards/standards.md
- 审查规则: .claude/standards/review-rules.md
- 测试标准: .claude/standards/test-standards.md
- 代码模式: .claude/standards/patterns/

## 目录约定
- 行为契约: .claude/contracts/
- 项目简报: .claude/briefs/ (不参与代码生成)
- 判断日志: .claude/judgment-logs/
- Feature 注册: .claude/contracts/registry.md
"

if [ -f "$CLAUDE_MD" ]; then
  if grep -q "HelmCode" "$CLAUDE_MD" 2>/dev/null; then
    echo "  ⚠ CLAUDE.md 已包含 HelmCode 配置，跳过"
  else
    echo "" >> "$CLAUDE_MD"
    echo "$CLAUDE_MD_HELMCODE" >> "$CLAUDE_MD"
    echo "  ✓ CLAUDE.md (已追加 HelmCode 配置)"
  fi
else
  echo "# 项目约束

## 技术栈
$TECH_STACK
$CLAUDE_MD_HELMCODE" > "$CLAUDE_MD"
  echo "  ✓ CLAUDE.md (已创建)"
fi

# ===== 完成 =====
SKILL_COUNT=${#SKILLS[@]}
STANDARDS_COUNT=$(find "$STANDARDS_TARGET" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ HelmCode 安装完成！"
echo ""
echo "  📦 已安装:"
echo "     Skills: ${SKILL_COUNT} 个"
echo "     Standards: ${STANDARDS_COUNT} 个文件"
echo ""
echo "  🚀 使用方式:"
echo "     /dev-flow          — AI 编程主工作流 (clarify → implement → verify)"
echo "     /clarify           — 拆解需求，生成行为契约"
echo "     /implement         — 读取行为契约，生成代码 + 判断日志"
echo "     /verify            — 验证代码 + 审查判断日志"
echo "     /analyze           — 架构合规分析"
echo ""
echo "  📝 工作流:"
echo "     1. /clarify — 描述需求 → 生成行为契约（人审查约束）"
echo "     2. /implement — 读取行为契约 → 生成代码 + 判断日志"
echo "     3. /verify — 验证代码 → 审查判断日志 → 确认提交"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"