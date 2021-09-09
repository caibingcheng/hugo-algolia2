# hugo-algolia2

项目改编自[hugo-algolia](https://github.com/replicatedhq/hugo-algolia), 用于hugo静态内容的搜索.

### New Features

- 修复原项目的一些问题
- 支持自定义URI格式
- 支持按照文件后缀过滤

### Installation

从[npm](https://npmjs.org)安装`hugo-algolia2`

```
npm install hugo-algolia2
```

或者

```
yarn add hugo-algolia2
```

### How does it work?

默认遍历hugo项目的`/content`路径下的文件, 并且按照['html','md']后缀过滤, 并且在`/public`下生成`algolia.json`. 具体配置参数可以使用`hugo-algolia2 --help`.

### Sending to Algolia

在hugo项目根目录下添加配置文件`config.yaml`, 如下:

```
---
baseURL: /
uri: :year:month/:slug

algolia:
  index: "index-name"
  key: "[your API key]"
  appID: "[your app id]"
---
```

URI是访问路径, 需要和hugo的配置相同. key需要填写Admin API Key.

配置之后,
```
hugo-algolia2 -s
```
可以上传algolia配置.

### TODOLIST

- [ ] 提供github action

# License
同[hugo-algolia](https://github.com/replicatedhq/hugo-algolia), 本项目也使用ISC License.
