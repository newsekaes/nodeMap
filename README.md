# 0. 前言
> 本组件的运行需要少量jquery.js 和 D3.js 的支持，之后或去掉对两者的依赖，全部使用原生js

# 1. 全局
## #View
- 类型：Constructor
- 参数：
{ Object } config
{ Object } option
- 用法

1. config 示例：
```
{
	nw: 200,
	nh: 70,
	npl: 30,
	npt: 15,
	page_container: '#page_container'
}
```
`nw`节点的宽度（nodeWidth）
`nh`节点的高度（nodeHeight）
`npl`节点的左右边距（nodePaddingLeft）
`npt`节点的上下边距（nodePaddingTop）
`page_container`map的外部元素选择器

2. option示例
```
{
	svg: document.querySelector('svg'),
	addBtn: document.querySelector('addBtn')
}
```
`svg`:应用于map的svg元素
`addBtn`:用于节点添加的交互性按钮

# 2. API说明
## #View.prototype.disable()
- 参数： 无
- 用法： 使 节点图的添加按钮、线和节点的点击事件响应 进入不可用状态

## #View.prototype.enable()
- 参数： 无
- 用法： 使 节点图的添加按钮、线和节点的点击事件响应 重新进入可用状态

## #View.prototype.addNode(option)
- 参数：
 {object} option
- 用法：
为当前图添加一个新节点。
- example:
```
view.addNode({
    x: 1,
	y: 1,
	id: 1
});
```

## #View.prototype.moveNode(option)
- 参数：
{object} option
- 用法：
移动所指示的节点（与节点相连的线也会自动变换）
- example：
```
view.moveNode({
	x: 2,
	y: 2,
	id: 1
});
```

## #View.prototype.delNode(id)
- 参数：
{ String | Number } id
- 用法：
删除所指示的节点（与节点相连的线也会自动删除）
- example：
```
view.delNode(1);
```

## #View.prototype.delLink(option)
- 参数：
{ object } option
- 用法：
删除所指示的连线
- example：
```
view.delLink({
	src: 1
	dst: 2
});
```

## #View.prototype.addLink(option)
- 参数：
{object} option
- 用法：
为指定的 源-目标 建立连线
- example：
```
view.addLink({
	src: 1,
	dst: 2
});
```

## #View.prototype.changeIcon(id, path)
- 参数：
{ String | Number } id
{ String } path
- 用法：
为指定的节点更换图标
- example：
```
view.changeIcon('1', '/static/map/budge.png');
```

## #View.prototype.intereact(intereactCallback)
- 参数：
{ function } intereactCallback
- 用法：
整个map的交互接口集合，详情参考intereactCallback
- example：

```
view.intereact((req) =>  {
	switch (req.type) {
		case 'node' :
			switch (req.opera) {
				case 'rename' :
					/*some handle*/
					break;
				case 'del' :
					/*some handle*/
					break;
				case 'move' :
					/*some handle*/
					break;
				case 'icon' :
					/*some handle*/
					break;
				case 'add' :
					/*some handle*/
					break;
				/* others */
			}
			break;
		case 'link' :
			/*like 'node' */
			break;
	}
});
```

## #View.prototype.linkId(src, dst)
- 参数：
{ String | Number } src
{ String | Number } dst
- 返回值：
{ String }
- 用法：
返回系统内部对一连线的内定id
- example：
```
view.linkId('1', '2');
```

## #View.prototype.netInit()
- 参数：无
- 用法：
初始化网格线

## #View.prototype.addModeInit()
- 参数：无
- 用法：
初始化map的节点添加交互模块
- example：

## #View.prototype.linkId(src, dst)
- 参数：
{ String | Number } src
{ String | Number } dst
- 返回值：
{ String }
- 用法：
返回系统内部对一连线的内定id
- example：
```
view.linkId('1', '2');
```
## #View.prototype.blankAppend(callback)
- 参数：
{ function } callback
- 用法：
对map中无节点的空白位置进行操作，具体操作由`callback`进行
`callback`接收两个参数`(x, y)`
`callback`会被多次调用
- example：

```
var blankArr = [];
view.blankAppend((x, y) => {
	blankArr.push({x, y});
});
```

## #View.prototype.clear()
- 参数：无
- 用法：
对整个map进行彻底的清空操作

# 3. 数据类型说明
## #intereactCallback
- 类型：Function
- 类别： 回调函数
- 回调内容：
{ Object } req
- 对照表

| req.name  | req.opera  | 特征数据 | 事件  | this.reflect |
| ------------ | ------------ | ------------ | ------------ | ------------ |
| node  | rename  | req.id, req.text  | 节点重命名  | this.reflect(req.text)  |
|   | del  | req.id  | 节点删除  | this.reflect(req.id)  |
|   | move  | req.id, req.x, req.y  | 节点移动  | this.reflect(req.x, req.y, req.id)  |
|   | icon  | req.id  | 节点改变图标  | this.reflect(req.id, path)  |
|   | add  | req.x, req.y, req.isServer  | 节点新增  | this.reflect(id, req.x, req.y, req.isServer, imgPath)  |
|   | pop  | req.subId, req.id  | 节点配置点击  | 无  |
| link  | link  | req.src, req.dst  | 连线添加  | this.reflect(req.src, req.dst)  |
|   | del  | req.src, req.dst  | 连线删除  | this.reflect(req.src, req.dst)  |

- this.reflect
this.reflect对应相应情况下的默认处理函数，该处理函数依次接收全部或部分的特征数据作为部分参数，进行map内的相应操作