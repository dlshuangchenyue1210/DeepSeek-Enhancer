# DeepSeek 网页端对话 DOM 观察记录

本文档记录 2026-05-28 在 DeepSeek 网页端对话页面的实测 DOM 信息，作为开发参考。

## 观察对象

目标页面：DeepSeek 网页端对话页面。

观察目标：

- 识别聊天消息区域。
- 识别用户提问节点。
- 识别 AI 回复节点。
- 记录页面中与消息解析相关的非消息节点特征。

## 聊天列表容器

已观察到聊天列表容器节点：

```html
<div class="ds-virtual-list-items _6f2c522">
  ...
</div>
```

该节点的文本内容中同时包含用户提问文本和 AI 回复文本。

示例内容包含：

```text
我在网页端向你提问，每条对话在网页层 DOM 会标注顺序吗？
已思考（用时 4 秒）
关于你提到的网页端 DOM 是否会为每条对话标注顺序...
```

已观察到的聊天列表容器 class：

```css
.ds-virtual-list-items
```

## 用户提问节点

已观察到用户提问节点结构：

```html
<div class="d29f3d7d ds-message _63c77b1" style="--panel-width: 0px;">
  我在网页端向你提问，每条对话在网页层 DOM 会标注顺序吗？
</div>
```

已观察到的用户提问节点包含以下 class：

```css
.ds-message
.d29f3d7d
._63c77b1
```

已观察到的用户提问文本直接位于该节点的 `innerText` 中。

已观察到的用户提问节点内部不包含：

```css
.ds-assistant-message-main-content
```

## AI 回复节点

已观察到 AI 回复正文节点包含以下 class：

```css
.ds-assistant-message-main-content
.ds-markdown
```

已观察到 AI 回复正文位于 `.ds-assistant-message-main-content` 节点内。

## 页面按钮与非消息节点

页面中存在大量按钮节点，示例 class 包含：

```css
.ds-icon-button
.ds-icon-button--m
.ds-icon-button--l
.ds-icon-button--xl
.ds-icon-button--sizing-container
.ds-icon-button--sizing-icon
```

按钮节点可能包含以下属性：

```html
role="button"
tabindex="0"
aria-disabled="false"
```

页面中已观察到以下输入或按钮相关节点类型：

```css
textarea
input
button
[role="button"]
```

## 消息顺序

在已观察页面中，用户提问节点和 AI 回复正文节点按 DOM 顺序出现在聊天列表容器内。

已观察到的消息节点 class：

```css
.ds-message
.ds-assistant-message-main-content
```

## 观察结论

2026-05-28 实测到的可参考 DOM 信息：

- 聊天列表容器包含 `.ds-virtual-list-items`。
- 用户提问节点包含 `.ds-message`。
- 用户提问文本直接位于 `.ds-message` 节点的 `innerText` 中。
- 用户提问节点内部未观察到 `.ds-assistant-message-main-content`。
- AI 回复正文节点包含 `.ds-assistant-message-main-content`。
- AI 回复正文节点可同时包含 `.ds-markdown`。
- 页面中存在按钮和输入相关节点：`textarea`、`input`、`button`、`[role="button"]`。
- 用户提问节点与 AI 回复正文节点按 DOM 顺序出现在聊天列表容器内。
