# NodeSeek auto 源码

- `config.js`：常量、字段配置与选项。
- `ui.js`：表单模板、通过 `GM_addStyle` 注入的样式与多机器书签界面。
- `logic.js`：计算、汇率、图片上传、Markdown 与表单状态。
- `threaded.js`：楼中楼、下滑自动加载、固定原生回复栏及切页清理；通过“功能开关”即时启停。
- `background.js`：自定义图片背景、毛玻璃主体、亮度与文字对比保护、自动取景及外观设置。
- `main.js`：NodeSeek 编辑器集成、事件处理和启动。

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
