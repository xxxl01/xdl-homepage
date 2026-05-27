CREATE DATABASE IF NOT EXISTS `xdl-homepage`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE `xdl-homepage`;

CREATE TABLE IF NOT EXISTS `nav_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '分类描述',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    KEY `idx_nav_categories_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='导航分类表';

CREATE TABLE IF NOT EXISTS `nav_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '导航项ID',
    `category_id` BIGINT UNSIGNED NOT NULL COMMENT '所属分类ID',
    `title` VARCHAR(100) NOT NULL COMMENT '导航标题',
    `url` VARCHAR(500) NOT NULL COMMENT '跳转链接',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '导航描述',
    `icon` VARCHAR(255) DEFAULT NULL COMMENT '图标地址或图标名称',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    KEY `idx_nav_items_category_sort` (`category_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='导航项表';
