-- HelmCode Demo slice — safe to delete after onboarding
-- 邮箱黑名单表(Demo 切片)。
-- 字段约定:
--   1. id            主键,自增;
--   2. gmt_create / gmt_modified  审计时间;
--   3. creator / modifier         审计人,操作时由 Service 填入;
--   4. deleted_id    软删字段:0 表示有效;删除时填本行 id,从而保证 (email_address, deleted_id) 唯一约束在反复增删场景下不冲突;
--   5. email_address 邮箱(全部转小写后存储)。

CREATE TABLE IF NOT EXISTS `email_blacklist` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `gmt_create`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `gmt_modified`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    `creator`       VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '创建人',
    `modifier`      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '修改人',
    `deleted_id`    BIGINT       NOT NULL DEFAULT 0 COMMENT '软删标识:0=有效,删除时填本行 id',
    `email_address` VARCHAR(256) NOT NULL COMMENT '黑名单邮箱地址',
    `remark`        VARCHAR(256)          DEFAULT NULL COMMENT '备注原因',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_email_deleted` (`email_address`, `deleted_id`),
    KEY `idx_gmt_create` (`gmt_create`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '邮箱黑名单(Demo)';
