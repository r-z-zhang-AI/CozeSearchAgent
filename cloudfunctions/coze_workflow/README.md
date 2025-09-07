# coze_workflow

代理调用扣子工作流 API（stream_run / run），隐藏 token，返回统一结构：

```
{ code: 0, data: { response_text, card_data, raw } }
```

使用步骤：
1. 在云函数环境变量中新增 `COZE_TOKEN`（扣子控制台生成的 Bearer token）。
2. 上传并部署该云函数（需安装依赖）。
3. 小程序端调用：

```js
wx.cloud.callFunction({
  name: 'coze_workflow',
  data: { workflow_id: '你的工作流ID', input: '用户输入', stream: false }
})
```

注意：
- 若使用流式(stream=true)，云函数会聚合SSE为最后一条JSON事件再返回。
- 若需要透传额外参数，可通过 `parameters` 字段传入。 