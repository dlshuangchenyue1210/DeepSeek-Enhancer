# DeepSeek 页面适配索引

返回[文件索引入口](../file-index.md)。本目录是 DeepSeek 页面 DOM 依赖的唯一归属；feature 只能消费 adapter 暴露的结构化数据或动作。

| 文件                                     | 定位与用途                                                        | 不该出现的内容                                                  |
| ---------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/platform/deepseek/types.ts`         | 页面适配层共享的会话、消息、轮次、公式与 `DeepSeekAdapter` 类型。 | 存储 schema、React UI、选择器实现。                             |
| `src/platform/deepseek/selectors.ts`     | 集中保存候选选择器、扩展根节点识别规则，并提供容错、去重的 query helpers。            | feature 业务判断、文件夹数据操作、hash class 作为唯一稳定依据。 |
| `src/platform/deepseek/routes.ts`        | 校验 DeepSeek host、识别会话路由、提取 ID 与生成规范 URL。        | DOM 查询、tab 权限调用、导航 UI。                               |
| `src/platform/deepseek/routes.test.ts`   | 验证会话路由识别、ID 提取和非会话路径拒绝。                       | 生产实现、真实 location 依赖、DOM 测试。                        |
| `src/platform/deepseek/conversations.ts` | 从路由和原生侧边栏解析当前及最近会话引用。                        | 缓存写入、文件夹操作、组件渲染。                                |
| `src/platform/deepseek/input.ts`         | 通过集中候选选择器返回 DeepSeek 输入区域。                        | 输入内容修改、自动发送、底层协议接管。                          |
| `src/platform/deepseek/messages.ts`      | 识别消息角色、稳定排序、生成消息 ID 并组装对话轮次。              | 导出 UI、持久化聊天正文、文件夹业务。                           |
| `src/platform/deepseek/markdown.ts`      | 把消息 DOM 转为 Markdown，并过滤思考标记、搜索伪影和页面控件。    | 文件下载、导出选择状态、未观察页面的专属业务规则。              |
| `src/platform/deepseek/messages.test.ts` | 验证角色识别、轮次分组、思考标记和搜索伪影清理。                  | 生产实现、真实网页访问、导出文件测试。                          |
| `src/platform/deepseek/math.ts`          | 从点击目标解析 TeX/MathML/展示模式，并标记可交互公式宿主。        | 复制菜单、MathJax 图像渲染、设置持久化。                        |
| `src/platform/deepseek/math.test.ts`     | 验证块级/行内公式提取和公式宿主标记。                             | 生产实现、剪贴板行为、renderer 测试。                           |
| `src/platform/deepseek/sidebar.ts`       | 查找可降级挂载点、管理原生会话拖拽生命周期、优先通过原生链接打开会话。 | 文件夹数据写入、React 树、接管 DeepSeek 导航协议。              |
| `src/platform/deepseek/sidebar.test.ts` | 验证原生拖拽、增量链接识别、扩展节点隔离和生命周期清理。         | 生产实现、真实 DeepSeek 页面、文件夹数据写入。                 |
| `src/platform/deepseek/observer.ts`      | 监听 DOM、标题与 history 路由变化，忽略扩展自身变更并报告防抖后的刷新范围。 | feature 初始化、持久化写入、对每次 mutation 的业务处理。        |
| `src/platform/deepseek/observer.test.ts` | 验证增量刷新范围、会话变化识别、扩展节点隔离和监听清理。         | 生产实现、真实浏览器导航、feature 业务。                       |
| `src/platform/deepseek/adapter.ts`       | 组合页面适配能力，向 feature 提供唯一结构化接口和消息定位动作。   | feature 业务状态、存储写入、重复选择器定义。                    |
