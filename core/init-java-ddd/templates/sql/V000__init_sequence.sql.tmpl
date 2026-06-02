-- {{appName}} — Zdal sequence metadata table.
-- NOT a demo file. Keep this even after removing the EmailBlacklist demo slice.
-- 由 app/infrastructure/.../config/SequenceConfiguration.java 引用,缺表则应用启动报错。

CREATE TABLE IF NOT EXISTS `{{appName}}_sequence` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `gmt_create`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `gmt_modified`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    `name`          VARCHAR(64)  NOT NULL COMMENT '序列名称',
    `value`         BIGINT       NOT NULL DEFAULT 0 COMMENT '当前序列值',
    `min_value`     BIGINT       NOT NULL DEFAULT 0 COMMENT '最小值',
    `max_value`     BIGINT       NOT NULL DEFAULT 9999999999 COMMENT '最大值',
    `step`          INT          NOT NULL DEFAULT 1000 COMMENT '步长(单次申请号段大小)',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_name` (`name`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '{{appName}} sequence 元数据表';
