/**
 * Created by Zhanglin on 2017/8/5.
 */
(function () {
    /*view层, 被data控制,仅用于展现，以及交互的结果反馈，其表现必须与data一致（即不能有自删除或自添加等违法操作）*/
    /* 约定：
     *  _x, _y 等代表数据化的坐标，单位量为一个网格；
     *  x, y 等代表视图化的坐标，单位为一个svg的单位长度
     * */
    var config = {
        nw: 200,
        nh: 70,
        npl: 30,
        npt: 15,
        page_container: '#page_container'
    };
    var coordinate = new Coordinate(config);//坐标计算模块
    /*svg text文本宽度计算模块*/
    var measureSpan = d3.select('#measureSpan')[0][0] || d3.select(config.page_container)
            .append('span')
            .attr('id', 'measureSpan')
            .style({
                'font-size': '16px',
                'position': 'fixed',
                'visibility': 'hidden',
                'z-index': '-1'
            })[0][0];
    measureSpan.getWidth = function (text) {
        this.innerText = text;
        return +this.offsetWidth / 16;
    };
    window.View = View.bind(null, config);
    function View(cfg, opt) {
        this.subId = null;
        this.cfg = cfg;
        var _this = this;
        var svg = opt.svg;//canvas svg
        cfg.svg = svg;
        this.svg = svg;
        this.addBtn = opt.addBtn
        this.container = document.querySelector(cfg.page_container);
        this.axisGroup = d3.select(svg).append('g').attr('class', 'axisGroup')[0][0];
        this.nodeGroup = d3.select(svg).append('g').attr('class', 'nodeGroup')[0][0];
        this.addIconGroup = d3.select(svg).append('g').attr('class', 'addIconGroup')[0][0];
        this.linkGroup = d3.select(svg).append('g').attr('class', 'linkGroup')[0][0];
        this.width = svg.clientWidth || 1800;
        this.height = svg.clientHeight || (window.innerHeight - this.container.getBoundingClientRect().top);
        this.nodeList = {};
        this.linkList = {};
        // this.register = {};//记录每个网格的占位
        this.f = null;//对外数据交互
        this.link = link({svg: svg, linkGroup: this.linkGroup});
        this.node = _Node({container: cfg.page_container, nodeList: this.nodeList});
        this.preLink = new PreLink(this.nodeList, this.link);
        this.combine = new Combine(this.nodeList, this.linkList/*, this.register*/);
        this.preLink.linkBind(function (req) {
            (typeof _this.f === 'function') && _this.f.call(
                {reflect: function (src, dst) {
                    _this.addLink({src: src, dst: dst});
                }},
                {type: "link", opera: "link", src: req.src, dst: req.dst}
            );
        });
        cfg.linkGroup = this.linkGroup;
        cfg.nodeGroup = this.nodeGroup;
        d3.select(svg).on('mousemove', function () {
            var coor = d3.mouse(_this.svg);
            _this.preLink.dotSearch({x: coor[0], y: coor[1]});
        });
        d3.select(svg).on('click', function () {
            var path = d3.event.path;
            if(path[0] === svg){
                _this.preLink.dotClick({id: null, direction: null})
            }
        })
        this.netInit();
        this.addModelInit();
    }
    View.prototype = {
        disable: function () {
            this.addBtn.style.pointerEvents = 'none';
            this.addBtn.style.display = 'none';
            this.node.disable();
            this.link.disable();
        },
        enable: function () {
            this.addBtn.style.pointerEvents = 'initial';
            this.addBtn.style.display = 'initial';
            this.node.enable();
            this.link.enable();
        },
        addNode: function (_opt) {
            var opt = JSON.parse(JSON.stringify(_opt));
            var _x = opt.x;
            var _y = opt.y;
            var regId = 'x' + _x + '_' + 'y' + _y;
            var _this = this;
            var viewCoor = coordinate.toViewCoor(_x, _y);
            opt.x = viewCoor.x;
            opt.y = viewCoor.y;
            var node = this.node.add(opt, this.cfg);
            this.nodeList[opt.id] = node;
            node.delBind(function (id) {
                (typeof _this.f === 'function') && _this.f.call(
                    {reflect: function (id) {
                        _this.delNode(id);
                    }},
                    {type: "node", opera: "del", id: id}
                );
            });
            node.moveBind(function (req) {
                var _new = _this.combine.moveable(req.x, req.y, req.id);
                if(!_new){ return false; }
                (typeof _this.f === 'function') && _this.f.call(
                    {reflect: function (x, y, id) {
                        _this.moveNode({
                            x: x,
                            y: y,
                            id: id
                        });
                    }},
                    {type: 'node', opera: 'move', x: _new._x, y: _new._y, id: req.id}
                );
            });
            node.iconBind(function (req) {
                (typeof _this.f === 'function') && _this.f.call(
                    {reflect: function (id, path) {
                        _this.changeIcon(id, path);
                    }},
                    {type: 'node', opera: 'icon', name: req.iconName, id: req.id}
                );
            });
            node.dotBind(function (req) {
                _this.preLink.dotClick(req);
            });
            node.popBind(function (id) {
                (typeof _this.f === 'function') && _this.f.call(null, {type: 'node', opera: 'pop',subId: _this.subId, id: id});
            });
            node.renameBind(function (text) {
                (typeof _this.f === 'function') && _this.f.call(this, {type: 'node', opera: 'rename', text: text, id: opt.id})
            })
        },
        moveNode: function (opt) {
            var _x = opt.x;
            var _y = opt.y;
            var id = opt.id;
            // if (this.register['x' + _x + '_y' + _y]) { return false; }
            this.combine.move(_x, _y, id);
        },
        // this.combine.move,
        delNode: function (id) {
            this.combine.delNode(id)
        },
        delLink: function (src, dst) {
            this.combine.delLink(src, dst)
        },
        addLink: function (opt) {
            var src = this.nodeList[opt.src];
            var dst = this.nodeList[opt.dst];
            src.target.push(opt.dst);
            dst.source.push(opt.src);
            var linkOpt = coordinate.link([src.x, src.y], [dst.x, dst.y]);
            linkOpt.id = this.linkId(opt.src, opt.dst);
            linkOpt.svg = this.svg;
            linkOpt.linkGroup = this.linkGroup
            var _this = this;
            var link = this.link.new(linkOpt);
            this.linkList[linkOpt.id] = link
            link.delBind(function (id) {
                (typeof _this.f === 'function') && _this.f.call(
                    {
                        reflect: function (src, dst) {
                            _this.delLink(src, dst);
                        }
                    },
                    {type: 'link', opera: 'del', src: opt.src, dst: opt.dst}
                );
            });
        },
        changeIcon: function (id, path) {
            this.nodeList[id].changeIcon(path);
        },
        intereact: function (f) {
            this.f = f;
        },
        linkId: function (src, dst) {
            return src + '_' + dst;
        },
        netInit: function () {
            var width = this.width;
            var height = this.height;
            var numX = Math.ceil(this.width / this.cfg.nw);
            var numY = Math.ceil(this.height / this.cfg.nh);
            var dataX = [];
            var dataY = [];
            for (var i = 1; i < numX; i++) {
                dataX.push(i * this.cfg.nw);
            }
            for (var j = 1; j < numY; j++) {
                dataY.push(j * this.cfg.nh);
            }
            var axisX = d3.select(this.axisGroup).select('.axisX');
            if(axisX.empty()){ axisX = d3.select(this.axisGroup).append('g').attr('class', 'axisX'); }
            var axisY = d3.select(this.axisGroup).select('.axisY');
            if(axisY.empty()){ axisY = d3.select(this.axisGroup).append('g').attr('class', 'axisY'); }
            axisX.selectAll('line').data(dataX).enter().append('line')
                .attr('x1', function (d) {
                    return d;
                })
                .attr('x2', function (d) {
                    return d;
                })
                .attr('y1', 0)
                .attr('y2', this.height)
                .attr('stroke', 'rgb(102, 116, 119)')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '9 6');
            axisY.selectAll('line').data(dataY).enter().append('line')
                .attr('x1', 0)
                .attr('x2', this.width)
                .attr('y1', function (d) {
                    return d;
                })
                .attr('y2', function (d) {
                    return d;
                })
                .attr('stroke', 'rgb(102, 116, 119)')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '9 6');
        },
        addModelInit: function () {
            var btn = this.addBtn;
            var _this = this;
            var addIcon = new AddIcon({ container: this.addIconGroup, btn: null }, this.cfg);
            var addWindow = new AddSelect({container: this.container});
            addIcon.clickBind(function (_x, _y) {
                addWindow.show();
                addWindow.okBind(function (type) {
                    (typeof _this.f === 'function') && _this.f.call(
                        {reflect: function (id, _x, _y, isServer, iconPath) {
                            _this.addNode({id: id, x: _x, y: _y, doubleDot: isServer, iconPath: iconPath});
                            addIcon.clear();
                            btn.down = false;
                        }},
                        {type: 'node', opera: 'add', x: _x, y: _y, isServer: type === 'server'}
                    );
                });
            });
            document.addEventListener('click', function (e) {
                if(e.target.className === addIcon.class || e.target === btn || addWindow.node.find(e.target).length){
                    return false;
                }
                addIcon.clear();
                btn.down = false;
            });
            btn.addEventListener('click', function (e) {
                if(this.down){return false} else {this.down = true}
                e.stopPropagation();
                _this.blankAppend(function (x, y) {
                    addIcon.create(x, y);
                });
            })
        },
        blankAppend: function (f) {
            var width = this.width;
            var height = this.height;
            var numX = Math.ceil(this.width / this.cfg.nw);
            var numY = Math.ceil(this.height / this.cfg.nh);
            var arr = [];
            var seize = {};
            for(var id in this.nodeList){
                if(this.nodeList.hasOwnProperty(id)){
                    var coor = coordinate.toDataCoor(this.nodeList[id].x, this.nodeList[id].y);
                    seize[coor._x + '_' + coor._y] = true;
                }
            }
            for(var i = 0; i <= numX; i++){
                for(var j = 0; j <= numY; j++){
                    if(!seize[i + '_' + j]){
                        arr.push([i, j]);
                    }
                }
            }
            arr.forEach(function (d) {
                f(d[0], d[1]);
            })
        },
        clear: function () {
            this.link.clear();
            for(var i in this.linkList){
                if(this.linkList.hasOwnProperty(i)){
                    delete this.linkList[i];
                }
            }
            this.nodeGroup.innerHTML = '';
            for(var j in this.nodeList){
                if(this.nodeList.hasOwnProperty(j)){
                    delete this.nodeList[j];
                }
            }
            this.preLink.clear();
        }
    };
    /*处理所有有关坐标的计算操作，原始坐标的输入，计算后坐标的输出等，网格的控制，其他数学公式的支持*/
    function Coordinate(cfg) {
        /*网格 n (net)*/
        var nw = cfg.nw;
        var nh = cfg.nh;
        var npl = cfg.npl;//net padding left
        var npr = npl;
        var npt = cfg.npt;
        var npb = cfg.npt;
        /*节点*/
        var width = nw - npl - npr;//节点的宽
        var height = nh - npt - npb;//节点的高
        /*节点内左图标*/
        var iconR = height / 2;//image diameter
        /*节点内端点坐标*/
        var dot1 = [npl, nh / 2];//左端点
        var dot2 = [nw - npr, nh / 2];//右端点
        this.link = function (src, dst) {
            var x1 = src[0],
                y1 = src[1],
                x2 = dst[0],
                y2 = dst[1];
            if (x1 === x2) {
                return {x1: x1 + dot2[0], y1: y1 + dot2[1], x2: x2 + dot2[0], y2: y2 + dot2[1]}
            } else if (x1 < x2){
                return {x1: x1 + dot2[0], y1: y1 + dot2[1], x2: x2 + dot1[0], y2: y2 + dot1[1]};
            } else {
                return {x1: x1 + dot1[0], y1: y1 + dot1[1], x2: x2 + dot2[0], y2: y2 + dot2[1]};
            }
            /*some opera*/
        };
        this.toViewCoor = function (_x, _y) {
            return {
                x: _x * nw,
                y: _y * nh
            };
        };
        this.toDataCoor = function (x, y) {
            return {
                _x: x % nw === 0 ? Math.ceil(x / nw) : Math.ceil(x / nw) - 1,
                _y: y % nh === 0 ? Math.ceil(y / nh) : Math.ceil(y / nh) - 1
            };
        };
        this.lineSlice = function (src, dst, cfg) {
            var dsrc = cfg.src,
                ddst = cfg.dst;
            var d = this.distance(src, dst);
            if (d <= 0) {
                return false
            }
            var k = this.k(src, dst);
            if (d < dsrc + ddst) {
                return {
                    x1: dsrc * k.kx + src.x,
                    y1: dsrc * k.ky + src.y,
                    x2: (dsrc + 1) * k.kx + src.x,
                    y2: (dsrc + 1) * k.ky + src.y
                }
                // dst.x = (dsrc + ddst) * k.kx + src.x;
                // dst.y = (dsrc + ddst) * k.ky + src.y;
            }
            return {
                x1: dsrc * k.kx + src.x,
                y1: dsrc * k.ky + src.y,
                x2: dst.x - ddst * k.kx,
                y2: dst.y - ddst * k.ky
            }
        };
        this.k = function (src, dst) {
            if (src.x === dst.x && src.y === dst.y) {
                return false;
            }
            var d = this.distance(src, dst);
            return {
                kx: (dst.x - src.x) / d,
                ky: (dst.y - src.y) / d
            }
        };
        this.distance = function (src, dst) {
            return Math.pow(Math.pow(src.x - dst.x, 2) + Math.pow(src.y - dst.y, 2), 0.5)
        };
        this.getDot = function (x, y, direction) {
            return direction === 'l' ? [dot1[0] + x, dot1[1] + y] : [dot2[0] + x, dot2[1] + y];
        }
    }
    /*组合处理模块，点和线的耦合操作，处理节点移动和删除时，相关连线变动坐标的派发*/
    function Combine(nodeList, linkList/*, register*/) {
        this.nodeList = nodeList;
        this.linkList = linkList;
        // this.register = register;
    }
    Combine.prototype = {
        move: function (_x, _y, id) {
            // if(!this.dataMoveable(_x, _y, id)){ return false; }
            // this.register['x' + _x + '_y' + _y] = id;
            var node = this.nodeList[id];
            var viewCoor = coordinate.toViewCoor(_x, _y);
            var oldDataCoor = coordinate.toDataCoor(node.x, node.y);
            // delete this.register['x' + oldDataCoor._x + '_y' + oldDataCoor._y]
            var x = viewCoor.x;
            var y = viewCoor.y;
            node.update(x, y);
            var rel = this.rel(id);
            rel.src.forEach(function (src) {
                src.link.update(coordinate.link([src.node.x, src.node.y], [node.x, node.y]));
            });
            rel.dst.forEach(function (dst) {
                dst.link.update(coordinate.link([node.x, node.y], [dst.node.x, dst.node.y]));
            });
        },
        delNode: function (id) {
            var _this = this;
            var node = this.nodeList[id];
            var dataCoor = coordinate.toDataCoor(node.x, node.y);
            // this.register['x' + dataCoor._x + '_y' + dataCoor._y] = null;
            var rel = this.rel(id);
            rel.src.forEach(function (src) {
                _this.delLink(src.node.id, id);
            });
            rel.dst.forEach(function (dst) {
                _this.delLink(id, dst.node.id);
            });
            node.remove();
            delete this.nodeList[id];
        },
        rel: function (id) {
            var _this = this;
            var node = this.nodeList[id];
            var source = node.source;//Array
            var destination = node.target;//Array
            var relate = {
                src: [],
                dst: []
            };
            source.forEach(function (srcId) {
                var src = _this.nodeList[srcId];
                var link = _this.linkList[View.prototype.linkId(srcId, id)];
                relate.src.push({
                    node: src,
                    link: link
                });
            });
            destination.forEach(function (dstId) {
                var dst = _this.nodeList[dstId];
                var link = _this.linkList[View.prototype.linkId(id, dstId)];
                /*some opera*/
                relate.dst.push({
                    node: dst,
                    link: link
                });
            });
            return relate;
        },
        delLink: function (src, dst) {
            var id = this.linkId(src, dst);
            this.linkList[id].remove();
            this.nodeList[src].target = this.nodeList[src].target.filter(function (d) { return !(d === dst) });
            this.nodeList[dst].source = this.nodeList[dst].source.filter(function (d) { return !(d === src) });
            delete this.linkList[id];
        },
        moveable: function (x, y, id) {
            var _new = coordinate.toDataCoor(x, y);
            return this.dataMoveable(_new._x, _new._y, id);
        },
        dataMoveable: function (_x, _y, id) {
            var thisNode = this.nodeList[id];
            var thisOld = coordinate.toDataCoor(thisNode.x, thisNode.y)
            if(_x === thisOld._x && _y === thisOld._y){

            }
            for (var i in this.nodeList) {
                if(this.nodeList.hasOwnProperty(i)){
                    var node = this.nodeList[i];
                    var old = coordinate.toDataCoor(node.x, node.y)
                    if (old._x === _x && old._y === _y) {
                        return false;
                    }
                }
            }
            return {_x: _x, _y: _y};
        },
        linkId: function (src, dst) {
            return src + '_' + dst;
        },
    };
    /*预连线模块，处理开始连线，进行连线选定，结束连线的各项流程，以及最后的结果确认*/
    function PreLink(nodeList, link) {
        this.nodeList = nodeList;
        this.dot = null;
        this.link = null;
        this.f = null;
        this.dotClick = function (req) {
            var direct = req.direction;
            var id = req.id;
            var node = this.nodeList[id];
            if (this.dot) {
                /*连线绘制中，正在寻找终点*/
                if(id === null) {
                    /*点到空出，取消操作*/
                    this.clear();
                } else if (this.dot === id) {
                    /*相同的节点，不做处理*/
                    return false;
                } else {
                    if(nodeList[this.dot].source.indexOf(id) >= 0 || nodeList[this.dot].target.indexOf(id) >= 0){ return false; }
                    /*不同的点，进行连接*/
                    (typeof this.f === 'function') && this.f.call(null, {src: this.dot, dst: id});
                    this.clear();
                    /*some operation*/
                }
            } else {
                if(id === null){ return false; }
                /*连线开始绘制，起始点已确定*/
                var dotCoor = coordinate.getDot(node.x, node.y, direct);
                this.link = link.new({x1: dotCoor[0], y1: dotCoor[1], x2: dotCoor[0] + (direct === 'l' ? -1 : 1), y2: dotCoor[1], unfirm: true});
                this.dot = id;
            }
        };
        this.dotSearch = function (req) {
            if(!this.dot){ return false; }
            var x = req.x;
            var y = req.y;
            var node = this.nodeList[this.dot];
            if(!this.dot){
                return false;
            } else {
                this.link.update({
                    x2: x,
                    y2: y
                });
            }
        };
        this.linkBind = function (f) {
            this.f = f;
        };
        this.clear = function () {
            this.link && this.link.remove();
            this.link = null;
            this.dot = null;
        }
    }
    /*展现节点的信息，包括位置信息，内容信息，各种状态下的样式转换*/
    function _Node(opt) {
        var renameFunction = null;
        var container = opt.container;
        var nodeList = opt.nodeList;
        var inputWidth = 90;
        var input = d3.select(container).append('input')
            .attr('class', 'nodeTextInput')
            .style('height', '14px')
            .style('width', inputWidth + 'px')
            .style('display', 'none')
            .style('position', 'fixed')
            .style('z-index', 10)
            .style('text-align', 'center')
        input[0][0].style.cssText = input[0][0].style.cssText + 'background-color: rgb(15, 56, 76) !important; border: none !important;'
        var callback = null;
        input[0][0].addEventListener('blur', function () {
            callback && callback.call(null, this.value);
            callback = null;
            input.style('display', 'none')
            input[0][0].value = '';
        });
        return {
            add: function (opt, cfg) {
                var newNode = new Node(opt, cfg);
                newNode.f._rename = function (client, f) {
                    callback = f;
                    var left = client.left + client.width / 2 - 45;
                    var top = client.top;
                    input.style('display', 'initial');
                    input.style('left', left + 'px').style('top', top + 'px');
                    input[0][0].focus();
                }
                newNode.enable();
                return newNode;
            },
            disable: function () {
                for(var k in nodeList){
                    if(nodeList.hasOwnProperty(k)){
                        nodeList[k].disable();
                    }
                }
            },
            enable: function () {
                for(var k in nodeList){
                    if(nodeList.hasOwnProperty(k)){
                        nodeList[k].enable();
                    }
                }
            }
        }
    }
    function Node(option, cfg) {
        this.node = null;
        this.source = [];
        this.target = [];
        this.x = option.x;
        this.y = option.y;
        this.f = {};
        this.text1 = option.text1;
        this.text2 = option.text2;
        this.doubleDot = option.doubleDot;
        this.id = option.id;
        this.iconPath = option.iconPath;
        this.init(cfg);
    }
    Node.prototype = {
        update: function (x, y) {
            d3.select(this.node)
                .attr('x', x)
                .attr('y', y);
            this.x = x;
            this.y = y;
        },
        changeIcon: function (path) {
            d3.select(this.node).select('image')
                .attr('xlink:href', path);
        },
        moveBind: function (f) {
            this.f.move = f;
        },
        dotBind: function (f) {
            this.f.dot = f
        },
        iconBind: function (f) {
            this.f.icon = f
        },
        init: function (cfg) {//cfg或可缓存优化
            var _this = this;
            var nodeGroup = cfg.nodeGroup;

            var nw = cfg.nw;
            var nh = cfg.nh;
            var npl = cfg.npl;//net padding left
            var npr = npl;
            var npt = cfg.npt;
            var npb = cfg.npt;
            /*节点*/
            var width = nw - npl - npr;//节点的宽
            var height = nh - npt - npb;//节点的高
            /*节点内左图标*/
            var iconR = height / 2;//image diameter
            var iconR2 = iconR * 0.8;
            /*节点内端点坐标*/
            var dot1 = [npl, nh / 2];//左端点
            var dot2 = [nw - npr, nh / 2];//右端点
            var dotR = 5;
            /*关键轮廓点*/
            var p1 = [npl + iconR, npt],
                p2 = [nw - iconR - npl, npt],
                p3 = [nw - iconR - npl, nh - npt],
                p4 = [npl + iconR, nh - npt],
                o1 = [npl + iconR, nh / 2],
                o2 = [nw - iconR - npl, nh / 2];
            /*text的中线*/
            var m = (width - iconR / 2) / 2 + npl + iconR;
            /*text1 和 text2 的高度*/
            var ty1 = npt + 15;
            var ty2 = nh - npb -15;
            /*text的字体大小*/
            var fontSize = 10;

            this.node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            nodeGroup.appendChild(this.node);
            var node = d3.select(this.node)
                .attr('width', nw)
                .attr('height', nh)
                .attr('viewBox', '0 0 '+ nw + ' ' + nh)
                .attr('x', this.x)
                .attr('y', this.y)
                .style('cursor', 'move');
            node.append('path').attr('d',
                'M ' + p1[0] + ' ' + p1[1] +
                ' L ' + p2[0] + ' ' + p2[1] +
                ' A ' + iconR + ' ' + iconR + ' 0 0 1 ' + p3[0] + ' ' + p3[1] +
                ' L ' + p4[0] + ' ' + p4[1] +
                ' A ' + iconR + ' ' + iconR + ' 0 0 1 ' + p1[0] + ' ' + p1[1] + 'z')
                .attr('stroke-width', 1)
                .attr('stroke', 'rgb(115, 154, 229)')
                .attr('fill', 'rgb(15, 56, 76)');
            node.append('circle').attr('cx', o1[0]).attr('cy', o1[1]).attr('r', iconR).attr('stroke-width', 2)
                .attr('stroke', 'rgb(115, 154, 229)')
                .attr('fill', 'rgb(15, 56, 76)');
            node.append('circle').attr('cx', o1[0]).attr('cy', o1[1]).attr('r', iconR2)
                .attr('stroke', 'rgb(115, 154, 229)')
                .attr('fill', 'rgb(15, 56, 76)');
            var icon = node.append('image')
                .attr('x', npl - iconR2 + iconR)
                .attr('y', npt - iconR2 + iconR)
                .attr('width', iconR2 * 2)
                .attr('height', iconR2 * 2)
                .attr('xlink:href', this.iconPath);
            this.icon = icon;
            icon.style('cursor', 'pointer');
            var dotRight = node.append('circle').attr('cx', dot2[0]).attr('cy', dot2[1]).attr('r', dotR)
                .attr('stroke', 'rgb(98, 207, 228)')
                .attr('fill', 'rgb(15, 56, 76)')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer');
            this.dotRight = dotRight;
            var dotLeft;
            if(this.doubleDot){
                dotLeft = node.append('circle').attr('cx', dot1[0]).attr('cy', dot1[1]).attr('r', dotR)
                    .attr('stroke', 'rgb(98, 207, 228)')
                    .attr('fill', 'rgb(15, 56, 76)')
                    .attr('stroke-width', 2)
                    .style('cursor', 'pointer');
                this.dotLeft = dotLeft;
            }
            var del = node.append('image')
                .attr('x', nw - 35)
                .attr('y', 10)
                // .attr('r', 8)
                // .attr('fill', 'red')
                .attr('xlink:href', '/resources/img/business/linkDel.png')
                .style('cursor', 'pointer');
            this.del = del;
            var text1 = this.text1 || '请命名名称';
            var width1 = measureSpan.getWidth(text1) * fontSize;
            var width2 = measureSpan.getWidth(this.text2) * fontSize;
            var name = node.append('text')
                .attr('x', m - width1 / 2)
                .attr('y', ty1)
                .attr('fill', 'white')
                .style('font-size', '10px')
                .text(text1)
                .style('cursor', 'text');
            node.append('text')
                .attr('x', m - width2 / 2)
                .attr('y', ty2)
                .attr('fill', 'white')
                .style('font-size', '10px')
                .text(this.text2);
            var drag = d3.behavior.drag()/*.origin(function () {
                return {
                    x: _this.x,
                    y: _this.y
                }
            })*/;
            this.name = name;
            drag.on('drag', function _drag() {
                if(_this.static){ return false; }
                _this.f.move && _this.f.move.call(null, {x: d3.event.x, y: d3.event.y, id: _this.id});
            });
            node.call(drag);
            dotLeft && dotLeft[0][0].addEventListener('click', function () {
                _this.f.dot && _this.f.dot.call(null, {id: _this.id, direction: 'l'});
            });
            dotRight[0][0].addEventListener('click', function () {
                _this.f.dot && _this.f.dot.call(null, {id: _this.id, direction: 'r'});
            });
            del[0][0].addEventListener('click', function () {
                if(_this.static){ return false; }
                _this.f.del && _this.f.del.call(null, _this.id);
            });
            icon[0][0].addEventListener('click', function () {
                _this.f.pop && _this.f.pop.call(null, _this.id);
            });
            _this.rename = function (text) {
                if(text){ _this.text1 = text; } else { text = '请命名名称' }
                var textWidth = measureSpan.getWidth(text) * fontSize;
                name.attr('x', m - textWidth / 2)
                    .attr('y', ty1)
                    .attr('fill', 'white')
                    .style('font-size', '10px')
                    .text(text);
            }
            name[0][0].addEventListener('click', function (e) {
                var callback = function (text) {
                    _this.f.rename.call({reflect: _this.rename}, text)
                }
                var text = _this.f._rename && _this.f._rename.call(e, name[0][0].getBoundingClientRect(), callback)
            })
        },
        remove: function () {
            d3.select(this.node).remove();
        },
        delBind: function (f) {
            this.f.del = f;
        },
        popBind: function (f) {
            this.f.pop = f;
        },
        renameBind: function (f) {
            this.f.rename = f;
        },
        disable: function () {
            this.static = true;
            this.dotRight.style('pointer-events', 'none');
            this.dotLeft && this.dotLeft.style('pointer-events', 'none');
            this.name.style('pointer-events', 'none');
            this.del.style('display', 'none');
            this.icon.style('pointer-events', 'initial');
            this.icon.style('opacity', 'initial');
            this.node.style.cursor = 'initial';
        },
        enable: function () {
            this.static = false;
            this.dotRight.style('pointer-events', 'initial');
            this.dotLeft && this.dotLeft.style('pointer-events', 'initial');
            this.name.style('pointer-events', 'initial');
            this.del.style('display', 'initial');
            this.icon.style('pointer-events', 'none');
            this.icon.style('opacity', '0.4');
            this.node.style.cursor = 'move';
        }
    };
    /*展现连线的信息，以及各种鼠标手势下的样式等*/
    function link(option) {
        var lineWidth = 3;
        var dotR = 5;
        var dotLineWidth = 2;
        var dr = dotR + dotLineWidth / 2;
        var svg = option.svg;
        var linkGroup = option.linkGroup;
        var stroke = 'rgb(98, 207, 228)';
        var fill = 'rgb(15, 56, 76)';
        var defs = d3.select(svg).append('defs');
        /*markerWidth 和 markerHeight 为相当于线宽的倍数*/
        var r = lineWidth / 2;
        var start = defs.append('marker')
            .attr('id', 'markerStart')
            .attr('viewBox', '0 0 '+ dr * 2 + ' ' + dr * 2)
            .attr('refX', dr + dr)
            .attr('refY', dr)
            .attr('markerWidth', 2 * dr / lineWidth)
            .attr('markerHeight', 2 * dr / lineWidth)
            .attr('orient', 'auto');
        start.append('circle')
            .attr('cx', dr)
            .attr('cy', dr)
            .attr('r', dotR)
            .attr('fill', fill)
            .attr('stroke', stroke)
            .attr('stroke-width', dotLineWidth);
        start.append('circle')
            .attr('cx', dr)
            .attr('cy', dr)
            .attr('r', r)
            .attr('fill', 'rgb(98, 207, 228)');

        var tri = 2 * lineWidth;
        var end1 = defs.append('marker')
            .attr('id', 'markerEnd1')
            .attr('refX', 0)
            .attr('refY', tri)
            .attr('viewBox', '0 0 ' + tri + ' ' + 2 * tri)
            .attr('markerWidth', tri / lineWidth)
            .attr('markerHeight', 2 * tri / lineWidth)
            .attr('orient', 'auto');
        end1.append('path')
            .attr('d', 'M 0 0 L ' + tri + ' ' + tri + ' L 0 ' + tri * 2 + ' Z')
            .attr('fill', 'rgb(98, 207, 228)');
        var end2 = defs.append('marker')
            .attr('id', 'markerEnd2')
            .attr('refX', 0)
            .attr('refY', tri)
            .attr('viewBox', '0 0 ' + (2 * tri + dr + dr) + ' ' + (2 * tri))
            .attr('markerWidth', (2 * tri + dr + dr) / lineWidth)
            .attr('markerHeight', (2 * tri) / lineWidth)
            .attr('orient', 'auto');
        end2.append('path')
            .attr('d', 'M 0 0 L ' + tri + ' ' + tri + ' L 0 ' + 2 * tri + ' Z')
            .attr('fill', 'rgb(98, 207, 228)');
        end2.append('circle')
            .attr('cx', tri + dr).attr('cy', tri).attr('r', dotR)
            .attr('stroke-width', dotLineWidth)
            .attr('stroke', stroke)
            .attr('fill', fill);
        end2.append('circle')
            .attr('cx', tri + dr).attr('cy', tri).attr('r', r)
            .attr('fill', 'rgb(98, 207, 228)');

        var del = d3.select(svg).append('g')
            .attr('id', 'linkDel')
            .style('display', 'none')
            .style('cursor', 'pointer');
        var delBtn = del.append('image').attr('xlink:href', '/resources/img/business/linkDel.png');
        var disable = false;
        svg.addEventListener('mousemove', function (e) {
            if(disable) { return false; }
            if(!delModule.link){ return false; }
            if(Array.prototype.indexOf.call(del[0][0].childNodes, e.target) >= 0){ return false; }
            if(e.target === delModule.link.link){ return false; }
            del.style('display', 'none');
            delModule.link = null;
        });
        delBtn.on('click', function () {
            var link = delModule.link;
            link.f.del.call(null, link.id);
        });
        var delModule = {
            link: null,
            bind: function (link) {
                var _this = this;
                var elem = link.link;
                d3.select(elem).on('mousemove.del', function () {
                    if(disable){ return false; }
                    _this.link = link;
                    var coor = d3.mouse(svg);
                    del.attr('transform', 'translate(' + (coor[0]) + ',' + (coor[1] - 12) + ')')
                    del.style('display', 'initial')
                });
            },
            hide: function () {
                del.style('display', 'none');
            }
        };

        var cfg = {
            end1: 'markerEnd1',
            end2: 'markerEnd2',
            start: 'markerStart',
            svg: svg,
            left: dotR + dotLineWidth / 2,
            right: dotR + dotLineWidth / 2 + tri,
            lineWidth: lineWidth,
            del: delModule,
            linkGroup: linkGroup
        };

        var _Line = Line.bind(null, cfg);
        return {
            new: function (option) {
                return new _Line(option);
            },
            disable: function () {
                disable = true;
            },
            enable: function () {
                disable = false;
            },
            clear: function () {
                linkGroup.innerHTML = '';
            }
        };
    }
    function Line(cfg, option) {
        this.link = null;
        this.id = option.id;
        this.f = {};
        this.x1 = option.x1;
        this.x2 = option.x2;
        this.y1 = option.y1;
        this.y2 = option.y2;
        this.svg = cfg.svg;
        this.cfg = cfg;
        this.unfirm = option.unfirm;
        this.init();
    }
    Line.prototype = {
        update: function (coor) {
            var x1 = coor.x1 || this.x1,
                x2 = coor.x2 || this.x2,
                y1 = coor.y1 || this.y1,
                y2 = coor.y2 || this.y2;
            this.x1 = x1;
            this.x2 = x2;
            this.y1 = y1;
            this.y2 = y2;
            var _coor = coordinate.lineSlice({x: x1, y: y1}, {x: x2, y: y2}, {src: this.cfg.left, dst: this.cfg.right});
            if (!_coor) { return false; }
            d3.select(this.link)
                .attr('x1', _coor.x1)
                .attr('x2', _coor.x2)
                .attr('y1', _coor.y1)
                .attr('y2', _coor.y2)
        },
        remove: function () {
            d3.select(this.link).remove();
        },
        delBind: function (f) {
            this.f.del = f;
        },
        init: function () {
            var _this = this;
            this.link = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            var link = d3.select(this.link);
            var coor = coordinate.lineSlice({x: this.x1, y: this.y1}, {x: this.x2, y: this.y2}, {src: this.cfg.left, dst: this.cfg.right});
            link.attr('x1', coor.x1).attr('x2', coor.x2).attr('y1', coor.y1).attr('y2', coor.y2)
                .attr('stroke-width', this.cfg.lineWidth)
                .attr('stroke', 'rgb(98, 207, 228)')
                .attr('marker-end', 'url(#' + (this.unfirm ? this.cfg.end1 : this.cfg.end2) + ')')
                .attr('marker-start', 'url(#' + this.cfg.start + ')');
            this.cfg.linkGroup.appendChild(this.link);
            _this.cfg.del.bind(this);
        },
    };
    /*人机交互下，定义新建节点行为方式的模块*/
    function AddIcon(opt,cfg) {
        var _this = this;
        this.f = {};
        var nw = cfg.nw;
        var nh = cfg.nh;
        var npl = cfg.npl;
        var npt = cfg.npt;
        var w = nw - 2 * npl;
        var h = nh - 2 * npt;
        var d = 15;
        var p1 = [nw / 2, nh / 2 - d];
        var p2 = [nw / 2, nh / 2 + d];
        var p3 = [nw / 2 - d, nh / 2];
        var p4 = [nw / 2 + d, nh / 2];
        this.ctn = opt.container;
        var btn = opt.btn;
        var defs = d3.select(this.ctn).append('defs');
        this.id1 = 'addIcon';
        this.id2 = 'addIconHover';
        this.class = 'addIcon';
        var icon = defs.append('g').attr('id', this.id1);
        icon.append('rect').attr('x', npl).attr('y', npt).attr('width', w).attr('height', h)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', 'rgb(58, 76, 82)');
        icon.append('path').attr('d', 'M ' + p1[0] + ' ' + p1[1] + ' L ' + p2[0] + ' ' + p2[1] + ' M ' + p3[0] + ' ' + p3[1] + ' L ' + p4[0] + ' ' + p4[1])
            .attr('stroke-width', 2)
            .attr('stroke', 'white');
        var iconH = defs.append('g').attr('id', this.id2);
        iconH.append('rect').attr('x', npl).attr('y', npt).attr('width', w).attr('height', h)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', 'rgb(147, 153, 156)');
        iconH.append('path').attr('d', 'M ' + p1[0] + ' ' + p1[1] + ' L ' + p2[0] + ' ' + p2[1] + ' M ' + p3[0] + ' ' + p3[1] + ' L ' + p4[0] + ' ' + p4[1])
            .attr('stroke-width', 2)
            .attr('stroke', 'white');
    }
    AddIcon.prototype = {
        clear: function () {
            d3.select(this.ctn).selectAll('.' + this.class).remove();
        },
        clickBind: function (f) {
            this.f.click = f;
        },
        create: function (_x, _y) {
            var _this = this;
            var coor = coordinate.toViewCoor(_x, _y);
            var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            this.ctn.appendChild(use);
            d3.select(use).attr('x', coor.x).attr('y', coor.y).attr('class', this.class).attr('xlink:href','#' + _this.id1);
            use.addEventListener('click', function (e) {
                e.stopPropagation();
                _this.f.click.call(_this, _x, _y);
            });
            // use.addEventListener('mouseenter', function (e) {
            //     d3.select(this).attr('xlink:href', '#' + _this.id2);
            // });
            // d3.select(use).on('mouseout', function () {

            //     d3.select(this).attr('xlink:href', '#' + _this.id1);
            // })
            // use.addEventListener('mouseout', function (e) {
            //
            // });

        }
    }
    function AddSelect(opt) {
        var _this = this;
        var container = opt.container;
        this.f = {client: function () {}, server: function () {}, ok: function () {}};
        this.clientBind = function (f) {
            this.f.client = f;
        }
        this.serverBind = function (f) {
            this.f.server = f;
        }
        this.select = null;
        var node = $('<div class="view_addWindow"></div>');
        this.node = node;
        opt.container.appendChild(node[0]);
        node.hide();
        var header = $(
            '<div class="view_addHeader">' +
                '<img src="" alt="">' +
                '<span>创建节点</span>' +
                // '<div class="view_addOff"></div>' +
            '</div>'
        ).appendTo(node);
        var body = $('' +
            '<div class="view_addBody">' +
                '<div class="view_clientAdd">' +
                    '<img src="" alt="" class="view_clientImg">' +
                    '<span>客户端节点</span>' +
                '</div>' +
                '<div class="view_serverAdd">' +
                    '<img src="" alt="" class="view_serverImg">' +
                    '<span>服务器节点</span>' +
                '</div>' +
            '</div>' +
            '').appendTo(node);
        var btns = $(
            '<div class="view_addBtns">' +
                '<button class="view_okBtn">确认</button>' +
                '<button class="view_celBtn">取消</button>' +
            '</div>'
        ).appendTo(node);
        var client = body.find('.view_clientImg');
        var server = body.find('.view_serverImg');
        var ok = btns.find('.view_okBtn');
        var cancel = btns.find('.view_celBtn');
        client.on('click', function () {
            _this.select = 'client';
            client.addClass('view_selected');
            server.removeClass('view_selected');
        });
        server.on('click', function () {
            _this.select = 'server';
            server.addClass('view_selected');
            client.removeClass('view_selected');
        });
        ok.on('click', function () {
            _this.f.ok.call(null, _this.select);
            _this.hide();
        });
        cancel.on('click', function () {
            _this.clear();
            _this.hide();
        })
        client.click();
        this.okBind = function (f) {
            this.f.ok = f;
        };
        this.clear = function () {
            this.select = null;
        };
        this.show = function () {
            node.show();
        };
        this.hide = function () {
            node.hide();
        }
    }
})();
(function () {
    window.Header = Header;
    function Header(cfg) {
        this.turn = 'on';
        this.unitWidth = cfg.unitWidth;
        var _this = this;
        this.node = document.createElement('div');
        this.node.style.height = '40px';
        this.headerList = [];
        this.f = null;
        this.addBtn = new AddItem({container: this.node, unitWidth: this.unitWidth});
        this.addBtn.bind(function () {
            var index = _this.headerList.length;
            _this.add();
            _this.f.call(null, {type: 'add', range: [index, index], index: index, name: ''});
        });
        this.list = new List({container: cfg.page_container});
        this.list.add({
            text: '编辑分组名称',
            f: function (item) {
                item.renameProgram();
            }
        });
        this.list.add({
            text: '当前组增加一列',
            f: function (item) {
                var oldRange = _this.getRange(item);
                item.setWidth(item.width + 1);
                _this.f.call(null, {type: 'extend', oldRange: oldRange, newRange: _this.getRange(item), index: _this.getIndex(item)})
            }
        });
        this.list.add({
            text: '当前组减少一列',
            f: function (item) {
                var oldRange = _this.getRange(item);
                item.setWidth(item.width - 1);
                _this.f.call(null, {type: 'shrink', oldRange: oldRange, newRange: _this.getRange(item), index: _this.getIndex(item)})
            }
        });
        this.list.add({
            text: '再组前插入分组',
            f: function (item) {
                _this.add({pre: item.node});
                _this.f.call(null, {type: 'add', range: _this.getRange(item), index: _this.getIndex(item) - 1});
            }
        });
        this.list.add({
            text: '删除当前分组',
            f: function (item) {
                var oldRange = _this.getRange(item);
                var index =  _this.getIndex(item);
                _this.remove(item);
                _this.f.call(null, {type: 'delete', range: oldRange, index: index})
            }
        });
    }
    Header.prototype = {
        add: function (opt) {
            var _this = this;
            var item;
            var pre = opt && opt.pre || this.addBtn.node;
            var width = opt && opt.width || 1;
            var name = opt && opt.name || '';
            var index = Array.prototype.indexOf.call(pre.parentNode.childNodes, pre);
            item = new HeaderItem({container: this.node, unitWidth: this.unitWidth, width: width, name: name});
            item.renameBind(function (name) {
                _this.f.call(null, {type: 'rename', name: name, index: _this.getIndex(item)});
            });
            this.headerList.splice(index, 0, item);
            this.list.bind(item.config, item);
            this.node.insertBefore(item.node, pre);
        },
        interface: function (f) {
            this.f = f;
        },
        remove: function (node) {
            var index = this.getIndex(node);
            this.headerList.splice(index, 1);
            node.remove()
        },
        getIndex: function (node) {
            return this.headerList.indexOf(node);
        },
        getRange: function (node) {
            var index = this.getIndex(node);
            var start = 0;
            for(var i = 0; i++; i <index){
                start += this.headerList[index].width;
            }
            start += 1;
            var stop = start + node.width - 1;
            return [start, stop];
        },
        clear: function () {
            this.headerList.forEach(function(d){
                d.remove();
            });
            this.headerList = [];
        },
        disable: function () {
            this.addBtn.node.style.visibility = 'hidden';
            this.headerList.forEach(function (item) {
                item.config.style.visibility = 'hidden';
            });
            this.turn = 'off'
        },
        enable: function () {
            this.addBtn.node.style.visibility = 'visible';
            this.headerList.forEach(function (item) {
                item.config.style.visibility = 'visible';
            });
            this.turn = 'on';
        }
    };
    function HeaderItem(cfg) {
        this.unitWidth = cfg.unitWidth;
        var _this = this;
        this.f = {};
        this.width = cfg.width || 1;
        this.name = cfg.name || '';
        this.node = document.createElement('div');
        this.node.setAttribute('class', 'headerItem');
        this.node.style.width = (this.width * this.unitWidth) + 'px';
        this.node.style.height = '40px';
        this.node.style.float = 'left';
        this.input = document.createElement('input');
        this.input.style.height = '100%';
        this.input.style.boxSizing = 'border-box';
        this.input.style.width = '100%';
        this.input.style.textAlign = 'center';
        this.input.style.color = 'white';
        this.input.style.cssText += 'border: none !important; background: transparent !important;'
        this.input.setAttribute('placeholder', '自定义分组名称');
        this.input.value = this.name;
        this.inputDisable(this.input);
        this.input.addEventListener('blur', function () {
            _this.inputDisable(this);
            _this.name = this.value;
            _this.f.rename.call(null, this.value);
        });
        this.node.appendChild(this.input);

        this.config = document.createElement('div');
        this.config.setAttribute('class', 'headerConfig');
        this.config.style.width = '40px';
        this.config.style.height = '100%';
        this.config.style.top = '-100%';
        this.config.style.position = 'relative';
        this.config.style.cursor = 'pointer';
        this.config.style.float = 'right';
        this.node.appendChild(this.config);

        // cfg.container.appendChild(this.node);
    }
    HeaderItem.prototype = {
        renameProgram: function () {
            this.inputEnable(this.input);
        },
        inputEnable: function (input) {
            input.removeAttribute('readonly');
            input.focus();
        },
        inputDisable: function (input) {
            input.setAttribute('readonly', true);
        },
        setWidth: function (n) {
            if(n <= 0)return false;
            this.width = n;
            this.node.style.width = (this.unitWidth * this.width) + 'px'
        },
        remove: function () {
            this.node.remove();
        },
        renameBind: function (f) {
            this.f.rename = f;
        }
    };
    function AddItem(cfg) {
        var _this = this;
        this.f = cfg.f;
        var unitWidth = cfg.unitWidth;
        this.node = document.createElement('div');
        this.node.setAttribute('class', 'headerItem');
        this.node.style.width = unitWidth + 'px';
        this.node.style.height = '40px';
        this.node.style.textAlign = 'center';
        this.node.style.float = 'left';
        this.node.style.fontSize = '40px';
        this.node.style.lineHeight = '30px';
        this.node.style.color = 'white';
        this.node.style.cursor = 'pointer';
        this.node.innerText = '+';
        this.node.addEventListener('click', function () {
            _this.f.call(null);
        });
        cfg.container.appendChild(this.node);
    }
    AddItem.prototype = {
        bind: function (f) {
            this.f = f;
        }
    };
    function List(cfg) {
        this.itemWidth = 135;
        this.itemHeight = 30;
        this.list = document.createElement('div');
        this.list.style.width = this.itemWidth + 'px';
        this.list.style.display = 'none';
        this.list.style.position = 'fixed';
        this.list.style.zIndex = '10';
        var _this = this;
        document.addEventListener('click', function (e) {
            e.stopPropagation();
            if(e.target.getAttribute('lst')){ return false; }
            _this.hide();
        });
        cfg.container.appendChild(this.list);
    }
    List.prototype = {
        add: function (cfg) {
            var _this = this;
            var listItem = document.createElement('p');
            listItem.setAttribute('class', 'listItem');
            listItem.style.lineHeight = this.itemHeight + 'px';
            listItem.style.height = this.itemHeight + 'px';
            listItem.style.width = this.itemWidth + 'px';
            listItem.innerText = cfg.text;
            listItem.setAttribute('lst', true);
            listItem.addEventListener('click', function () {
                cfg.f.call(null, _this.bindElem);
                _this.hide();
            });
            this.list.appendChild(listItem);
        },
        hide: function () {
            this.list.style.display = 'none';
        },
        show: function () {
            this.list.style.display = 'initial';
        },
        bind: function (elem, item) {
            var _this = this;
            elem.addEventListener('click', function (e) {
                var rect = this.getBoundingClientRect();
                e.stopPropagation();
                _this.bindElem = item;
                _this.list.style.left = (rect.left + rect.width - _this.itemWidth) + 'px';
                _this.list.style.top = (rect.top + rect.height + 3) + 'px';
                _this.show();
            });
            elem = null;
        }
    };
})()