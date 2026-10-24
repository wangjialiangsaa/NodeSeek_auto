# NodeSeek auto 源码

`tools/build.js` 按下列顺序拼接模块，包进同一个立即执行函数，因此各文件共享作用域：

- `header.txt`：油猴元数据（版本、权限、更新地址）。
- `config.js`：常量、字段配置与选项。
- `ui.js`：表单模板、通过 `GM_addStyle` 注入的样式与多机器书签界面。
- `logic.js`：计算、汇率、Markdown、表单状态、功能开关、帖子过滤、交易状态、回复追踪与抽奖。
- `image-upload.js`：编辑器图片上传与上传中占位。
- `toolbar.js`：编辑栏“🐔 工具”折叠面板。
- `auto-tasks.js`：每日签到、抽奖帖自动回复及“自动化”设置。
- `author-info.js`：楼层昵称下的公开用户资料。
- `threaded.js`：楼中楼、下滑自动加载、固定原生回复栏及切页清理；通过“功能开关”即时启停。
- `home-feed.js`：主页与列表页下滑自动续页。
- `background.js`：自定义图片背景、毛玻璃主体、亮度与文字对比保护、自动取景及外观设置。
- `sticky-header.js`：顶部导航固定。
- `main.js`：NodeSeek 编辑器集成、事件处理和启动。

## 性能约定

页面入口与标记由 `main.js` 的主 `MutationObserver` 统一驱动（楼中楼、主页续页等模块自带的观察器均已过滤自身节点并做了防抖）。轻量且需要立即生效的处理（顶栏、背景、帖子过滤、后台任务调度）在回调里同步执行；其余入口与标记的渲染合并到下一帧，连续 DOM 变化每帧最多执行一轮，后台页签由定时器兜底。新增页面渲染函数时，应保持幂等并加入 `renderPageEnhancements()`，不要为此另挂整页观察器。滚动、尺寸变化中的位置测量同样按帧合并。

1.4.71 新增自定义背景与外观设置：从个人统计栏“外观”或油猴菜单“背景与外观”进入，默认关闭。支持 HTTP / HTTPS 图片直链、预览与保存、毛玻璃参数、自动取景和手动焦点。自动取景依据画面细节分布；跨域像素不可读时使用深色保护底和居中位置。图片加载成功后才保存新设置，关闭设置还原未保存预览，恢复默认关闭背景并清空地址。

背景模式会根据亮度调整主体面板和文字，必要时提高实际不透明度，以保护正文、次要文字和链接的对比度；代码、编辑器、徽章与功能按钮保留原配色。

修改源码后执行：

```sh
node tools/build.js build
node --test test/*.test.cjs worker/test/*.test.mjs
node --check 'NodeSeek Issue Templates.user.js'
node --check 'NodeSeek Issue Templates.min.user.js'
```

根目录的 `NodeSeek Issue Templates.user.js` 与 `NodeSeek Issue Templates.min.user.js` 是可直接导入油猴的构建产物，不直接编辑。
