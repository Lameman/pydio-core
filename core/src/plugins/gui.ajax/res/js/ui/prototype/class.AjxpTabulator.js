/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <https://pydio.com>.
 */

Class.create("AjxpTabulator", AjxpPane, {

    tabulatorData: null,
    tabsConfigs: null,
    _eventPath: null,
	/**
	 * Constructor
	 * @param $super klass Superclass reference
	 * @param htmlElement HTMLElement Anchor of this pane
	 * @param tabulatorOptions Object Widget options
	 */
	initialize : function($super, htmlElement, tabulatorOptions){
		$super(htmlElement, tabulatorOptions);
		this.tabulatorData 	= $A(tabulatorOptions.tabInfos);
        if(tabulatorOptions.registerAsEditorOpener){
            pydio.UI.registerEditorOpener(this);
        }
        if(tabulatorOptions.events){
            var events = $H();
            $H(tabulatorOptions.events).each(function(pair){
                var callback = new Function(pair.value).bind(this);
                document.observe(pair.key, callback);
                events.set(pair.key, callback);
            }.bind(this));
            this.options.events = events;
        }
        if(tabulatorOptions.saveState){
            this.tabsConfigs = $H();
        }
		// Tabulator Data : array of tabs infos
		// { id , label, icon and element : tabElement }.
		// tab Element must implement : showElement() and resize() methods.
		// Add drop shadow here, otherwise the negative value gets stuck in the CSS compilation...
		var div = new Element('div', {className:'tabulatorContainer panelHeader'});
        if(htmlElement.hasClassName('horizontal_tabulator') && Modernizr.flexbox){
            var panelsCont = new Element('div', {className:'tabulatorPanelsContainer'});
            this.htmlElement.insert(panelsCont);
            this.htmlElement.select('> div').each(function(d){
                if(d.hasClassName('tabulatorPanelsContainer')) return ;
                panelsCont.insert(d);
            });
        }
		$(this.htmlElement).insert({top:div});
        var shortener = this.shortenLabel;

        this.tabulatorData.each(function(tabInfo){
            var tab = this._renderTab(tabInfo);
			div.insert(tab);
			this.selectedTabInfo = tabInfo; // select last one by default
            var paneObject = this.getAndSetAjxpObject(tabInfo);
            if(!tabInfo.label && paneObject){
                paneObject.getDomNode().observe("editor:updateTitle", function(event){
                    tabInfo.headerElement.down(".tab_label").update(shortener(event.memo));
                });
                paneObject.getDomNode().observe("editor:updateIconClass", function(event){
                    tabInfo.headerElement.down("span").replace(new Element('span',{className:event.memo}));
                });
            }
            if($(tabInfo.element)){
                $(tabInfo.element).observe("widget:updateTitle", function(event){
                    tabInfo.headerElement.down(".tab_label").update(shortener(event.memo));
                });
            }
            if(this.options.saveState){
                paneObject.getDomNode().observe("widget:updateState", this.saveState.bind(this));
            }
		}.bind(this));
        if(this.options.headerToolbarOptions){
            var tbD = new Element('div', {id:"display_toolbar"});
            div.insert({top:tbD});
            this.tb = new ActionsToolbar(tbD, this.options.headerToolbarOptions);
        }
        if(tabulatorOptions.defaultTabId){
            this.switchTabulator(tabulatorOptions.defaultTabId);
        }
        document.observe("ajaxplorer:component_config_changed", function(event){
            if(event.memo.className == "AjxpTabulator::"+htmlElement.id){
                this.parseComponentConfig(event.memo.classConfig.get("all"));
            }
        }.bind(this));
        if(this.options.saveState){
            document.observe("ajaxplorer:user_logged", this.loadState.bind(this));
            this.loadState();
        }
        if(this.options.route){
            var routeOptions = this.options.route;
            if(pydio.Router) {
                this._bindToRouter(routeOptions);
            } else pydio.observeOnce("loaded", function(){
                if(pydio.Router) this._bindToRouter(routeOptions);
            }.bind(this));
        }

	},

    _renderTab:function(tabInfo){
        var td;
        if(tabInfo.ajxpClass && tabInfo.ajxpOptions){
            td = new Element('span', {className:'toggleHeader'});
            var klass = Class.getByName(tabInfo.ajxpClass);
            new klass(td, tabInfo.ajxpOptions);
            tabInfo.headerElement = td;
            if(tabInfo.closeable){
                td.insert(new Element('span', {className:'mdi mdi-close tab_close_button'}));
                td.down('.tab_close_button').observe('click', function(){
                    this.closeTab(tabInfo.id);
                }.bind(this));
            }
            return td;
        }else{
            var label = "";
            if(tabInfo.label){
                label = MessageHash[tabInfo.label] || tabInfo.label;
            }
            var title = MessageHash[tabInfo.title] || label.stripTags();
            title = He.escape(title);
            label = He.escape(label);
            var options = {className:'toggleHeader toggleInactive'};
            if(!this.options.tabsTips){ options.title = title; }
            td = new Element('span', options);
            var short = this.shortenLabel(label);
            if(this.options.tabsTips || short!=label){
                var horizontal = this.htmlElement.hasClassName('left_tabulator');
                modal.simpleTooltip(
                    td,
                    horizontal?'<div class="simple_tooltip_title">' + label+'</div>'+title:title,
                    this.options.tabsTips,
                    horizontal?"left_arrow_tip":"down_arrow_tip",
                    "element");
            }
            if(tabInfo.icon){
                td.insert('<img width="16" height="16" align="absmiddle" src="'+resolveImageSource(tabInfo.icon, '/images/actions/ICON_SIZE', 16)+'">');
            }
            if(tabInfo.iconClass){
                td.insert(new Element('span', {className:tabInfo.iconClass}));
            }
            td.insert('<span class="tab_label" ajxp_message_id="'+tabInfo.label+'">'+short+'</span>');
            td.observe('click', function(){
                this.switchTabulator(tabInfo.id);
            }.bind(this) );
            if(tabInfo.closeable){
                td.insert(new Element('span', {className:'mdi mdi-close tab_close_button'}));
                td.down('.tab_close_button').observe('click', function(){
                    this.closeTab(tabInfo.id);
                }.bind(this));
            }
            tabInfo.headerElement = td;
            disableTextSelection(td);
            return td;
        }

    },

    shortenLabel: function(label){
        if(label && label.innerHTML !== undefined){
            if(label.down('.filenameSpan')){
                var cont = label.down('.filenameSpan').innerHTML;
                cont = He.escape(cont);
                if(cont.length > 25){
                    cont = cont.substr(0,7)+"[...]"+cont.substr(-13);
                    label.down('.filenameSpan').update(cont);
                }
            }
            return label;
        }
        label = label.stripTags();
        if(!label || !label.length) return '';
        if(label.length > 25){
            return label.substr(0,7)+"[...]"+label.substr(-13);
        }
        return label;
    },

    openEditorForNode:function(ajxpNode, editorData){
        if(this.options.uniqueTab){
            // Unique Tab: close anyway
            var editorId = 'unique-editor';
            var existing = this.tabulatorData.detect(function(internalInfo){return internalInfo.id == editorId;});
            if(existing && existing.ajxpObject) {
                this.closeTab(editorId, true);
            }
            this.addTab({
                id:editorId,
                label:editorData.text,
                iconClass:editorData.icon_class,
                closeable:true
            }, {
                type:"editor",
                editorData:editorData,
                node:ajxpNode
            });
            return;
        }
        this.addTab({
            id:editorData.id + ":/" + ajxpNode.getPath(),
            label:editorData.text,
            iconClass:editorData.icon_class,
            closeable:true
        }, {
            type:"editor",
            editorData:editorData,
            node:ajxpNode
        });
    },

    parseComponentConfig: function(domNode){
        var contentNodes = XMLUtils.XPathSelectNodes(domNode, "additional_tab");
        // Check additional classes
        var detectedClasses = $H();
        contentNodes.each(function(n){
            var cdataContent = n.firstChild.nodeValue;
            if(cdataContent){
                detectedClasses = detectedClasses.merge(pydio.UI.findAjxpClassesInText(cdataContent));
            }
        });
        ResourcesManager.loadClassesAndApply(detectedClasses.keys(), function(){
            contentNodes.each(function(addNode){
                var cdataContent = addNode.firstChild.nodeValue;
                var anchor = this.htmlElement;
                if(this.htmlElement && this.htmlElement.down('.tabulatorPanelsContainer')){
                    anchor = this.htmlElement.down('.tabulatorPanelsContainer');
                }
                if(cdataContent && anchor){
                    if(!anchor.down('#'+addNode.getAttribute("id"))){
                        anchor.insert(cdataContent);
                        var compReg = $A();
                        pydio.UI.buildGUI(anchor.down('#'+addNode.getAttribute("id")), compReg);
                        if(compReg.length) pydio.UI.initAjxpWidgets(compReg);
                    }
                    this.addTab(addNode.getAttribute("tabInfo").evalJSON(), addNode.getAttribute("paneInfo").evalJSON());
                }
            }.bind(this));
        }.bind(this));
    },

    /**
     *
     * @param tabInfo
     * @param paneInfo
     * @param skipStateSave
     */
    addTab: function(tabInfo, paneInfo, skipStateSave){

        if(paneInfo.nodePath && !paneInfo.node){
            // Find node in root
            ajaxplorer.getContextHolder().loadPathInfoAsync(paneInfo.nodePath, function(n){
                if(n.__className && n.getPath){
                    paneInfo.node = n;
                    this.addTab(tabInfo, paneInfo, skipStateSave);
                }
            }.bind(this));
            return;
        }

        if(this.options.saveState){
            var confPaneInfo = Object.clone(paneInfo);
            this.tabsConfigs.set(tabInfo.id, {TAB:Object.clone(tabInfo), PANE: confPaneInfo});
        }
        var existing = this.tabulatorData.detect(function(internalInfo){return internalInfo.id == tabInfo.id;});
        if(existing) {
            if(!existing.dontFocus) {
                this.switchTabulator(existing.id);
            }
            return;
        }
        if(tabInfo.position == undefined || this.tabulatorData.size() < tabInfo.position){
            $(this.htmlElement).down('.tabulatorContainer').insert(this._renderTab(tabInfo));
        }else{
            var index = Math.max(tabInfo.position-1, 0);
            $(this.htmlElement).down('.tabulatorContainer').down('span.toggleHeader', index).insert({before:this._renderTab(tabInfo)});
        }
        if(!tabInfo.element){
            // generate a random element id
            var randomId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });
            tabInfo.element = "dynamic-panel-" + randomId;
        }

        if(!$(this.htmlElement).down('#'+tabInfo.element)){
            $(this.htmlElement).insert(new Element("div", {id:tabInfo.element, className:'vertical_layout'}));
        }
        fitHeightToBottom($(this.htmlElement).down("#"+tabInfo.element), null, this.options.fitMarginBottom);
        var shortener = this.shortenLabel;

        if(paneInfo.type == 'editor' && paneInfo.node && paneInfo.node.getPath){
            var editorData;
            if(paneInfo.editorID){
                editorData = pydio.Registry.findEditorById(paneInfo.editorID);
            }else if(paneInfo.editorData){
                editorData = paneInfo.editorData;
            }else{
                var selectedMime = getAjxpMimeType(paneInfo.node);
                var editors = pydio.Registry.findEditorsForMime(selectedMime);
                if(editors.length && editors[0].openable){
                    editorData = editors[0];
                }
            }
            if(editorData && paneInfo.node){
                pydio.Registry.loadEditorResources(editorData.resourcesManager);
                var oForm = $("all_forms").down("#"+editorData.formId).cloneNode(true);
                $(tabInfo.element).insert(oForm);
                var editorOptions = {
                    closable: false,
                    context: this,
                    editorData: editorData
                };
                if(Modernizr.flexbox) oForm.addClassName('vertical_fit');
                var editor = eval ( 'new '+editorData.editorClass+'(oForm, editorOptions)' );
                editor.getDomNode().observe("editor:updateTitle", function(event){
                    tabInfo.headerElement.down(".tab_label").update(shortener(event.memo));
                });
                editor.getDomNode().observe("editor:updateIconClass", function(event){
                    tabInfo.headerElement.down("span").replace(new Element('span',{className:event.memo}));
                });
                editor.open(paneInfo.node);
                tabInfo.ajxpObject = editor;
                tabInfo.ajxpNode = paneInfo.node;
                editor.resize();
                // SERIALIZE CONFIG
                if(confPaneInfo){
                    if(confPaneInfo.editorData) {
                        confPaneInfo.editorID = confPaneInfo.editorData.id;
                        delete confPaneInfo['editorData'];
                    }
                    if(confPaneInfo.node){
                        confPaneInfo.nodePath = confPaneInfo.node.getPath();
                        delete confPaneInfo['node'];
                    }
                }
            }
        }else if(paneInfo.type == 'widget'){
            if(paneInfo.widgetClassName) paneInfo.widgetClass = Class.getByName(paneInfo.widgetClassName);
            if(paneInfo.widgetClass && paneInfo.widgetOptions){
                var widgetInstance = new paneInfo.widgetClass($(tabInfo.element), paneInfo.widgetOptions);
                $(tabInfo.element).observe("widget:updateTitle", function(event){
                    tabInfo.headerElement.down(".tab_label").update(shortener(event.memo));
                });
                // SERIALIZE CONFIG
                if(confPaneInfo){
                    confPaneInfo.widgetClassName = widgetInstance.__className;
                    widgetInstance.getDomNode().observe("widget:updateState", this.saveState.bind(this));
                }
            }
        }
        this.tabulatorData.push(tabInfo);
        if(!tabInfo.dontFocus){
            this.switchTabulator(tabInfo.id);
            window.setTimeout(this.resize.bind(this), 750);
        }else{
            var ajxpObject = this.getAndSetAjxpObject(tabInfo);
            ajxpObject.showElement(false);
        }
        this.resize();
        if(!skipStateSave) this.saveState();
        if(this.htmlElement) {
            this.htmlElement.writeAttribute("data-ajxpTabsCount", this.tabulatorData.size());
        }
    },

    /**
     *
     * @param tabId
     */
    closeTab: function(tabId, skipSaveState){
        var ti;
        var previousTab;
        this.tabulatorData.each(function(tabInfo){
            if(tabInfo.id == tabId){
                if(!tabInfo.closeable){
                    throw $break;
                }
                var ajxpObject = this.getAndSetAjxpObject(tabInfo);
                if(ajxpObject){
                    if(ajxpObject.validateClose){
                        var test = ajxpObject.validateClose();
                        if(!test) throw $break;
                    }
                    ajxpObject.showElement(false);
                    ajxpObject.destroy();
                }
                var pane = $(this.htmlElement).down('#'+tabInfo.element);
                if(pane){
                    pane.remove();
                }
                tabInfo.headerElement.stopObserving("click");
                tabInfo.headerElement.remove();
                ti = tabInfo;
                throw $break;
            }
            previousTab = tabInfo;
        }.bind(this));
        if(ti){
            this.tabulatorData = this.tabulatorData.without(ti);
            if(this.options.saveState){
                this.tabsConfigs.unset(tabId);
            }
            if(previousTab) this.switchTabulator(previousTab.id);
            else if(this.tabulatorData.length) this.switchTabulator(this.tabulatorData.first().id);

            this.resize();
            if(!skipSaveState) this.saveState();
            if(this.htmlElement) {
                this.htmlElement.writeAttribute("data-ajxpTabsCount", this.tabulatorData.size());
            }
        }
    },

	/**
	 * Tab change
	 * @param tabId String The id of the target tab
	 */
	switchTabulator:function(tabId){
        if(this.crtTabId && this.crtTabId == tabId && !this.options.uniqueTab) return;
		var toShow ;
        var toShowElement;
		this.tabulatorData.each(function(tabInfo){
			var ajxpObject = this.getAndSetAjxpObject(tabInfo);
            tabInfo.headerElement.removeClassName("toggleInactiveBeforeActive");
			if(tabInfo.id == tabId){
				tabInfo.headerElement.removeClassName("toggleInactive");
				if(tabInfo.headerElement.down('img')) tabInfo.headerElement.down('img').show();
				if(ajxpObject){
					toShow = ajxpObject;
                    toShowElement = tabInfo.element;
				}
				this.selectedTabInfo = tabInfo;
                if(tabInfo.headerElement.previous('.toggleHeader')){
                    tabInfo.headerElement.previous('.toggleHeader').addClassName('toggleInactiveBeforeActive');
                }
			}else{
				tabInfo.headerElement.addClassName("toggleInactive");
                if(tabInfo.headerElement.down('img')) tabInfo.headerElement.down('img').hide();
				if(ajxpObject){
					ajxpObject.showElement(false);
                    if($(tabInfo.element)) $(tabInfo.element).hide();
				}
			}
		}.bind(this));
		if(toShow){
            if($(toShowElement) && (!$(toShowElement).visible() || parseInt($(toShowElement).getStyle("height")) == 0)){
                if($(toShowElement)) $(toShowElement).show();
                fitHeightToBottom($(toShowElement), null, this.options.fitMarginBottom);
                toShow.showElement(true);
            }
            if(this.htmlElement && this.htmlElement.up('div[ajxpClass="Splitter"]') && this.htmlElement.up('div[ajxpClass="Splitter"]').ajxpPaneObject){
                var splitter = this.htmlElement.up('div[ajxpClass="Splitter"]').ajxpPaneObject;
                if(splitter.splitbar.hasClassName('folded') && (Element.descendantOf(this.htmlElement, splitter.paneA) || this.htmlElement == splitter.paneA ) ){
                    splitter.unfold();
                }
            }
            toShow.resize();
		}
        if(this.options.headerToolbarOptions){
            pydio.getController().fireSelectionChange();
        }
        if(this.htmlElement) {
            this.htmlElement.writeAttribute("data-ajxpTabsCount", this.tabulatorData.size());
        }
        this.resize();
        this.crtTabId = tabId;
        this.notify("switch", tabId);

	},

    switchToFirstIfPathDiffers: function(event){
        var cNode = event.memo;
        if(this._eventPath && cNode.getPath() != this._eventPath){
            this.switchTabulator(this.tabulatorData.first().id);
        }
        this._eventPath = cNode.getPath();
    },

    _bindToRouter: function(routeOptions){
        this.observe("switch", function(tabId){
            if(tabId){
                pydio.Router.router.navigate(routeOptions.base + "/" + tabId);
            }
        });
        this._routerObserver = function(object){
            if('/' + object.workspace === routeOptions.base){
                var tabId = PathUtils.getBasename(object.path);
                if(tabId) {
                    this.switchTabulator(tabId);
                }else{
                    this.switchTabulator(this.tabulatorData.first().id);
                }
            }
        }.bind(this);
        pydio.observe("routechange", this._routerObserver);
        window.setTimeout(function(){
            this.notify("switch", this.tabulatorData.first().id);
        }.bind(this), 500);
    },

    /**
	 * Resizes the widget
	 */
	resize : function(size, loop){
		if(!this.selectedTabInfo || !this.htmlElement) return;
        if(this.options.fit && this.options.fit == 'height'){
            fitHeightToBottom(this.htmlElement, this.options.fitParent);
        }
        if(this.htmlElement.hasClassName('horizontal_tabulator')){
            var tabContainer = this.htmlElement.down('div.tabulatorContainer');
            fitHeightToBottom(tabContainer, null, this.options.fitMarginBottom);
            if(!Modernizr.flexbox){
                var pWidth = this.htmlElement.getWidth() - tabContainer.getWidth();
                this.htmlElement.select('> div:not(.tabulatorContainer)').invoke('setStyle', {width:pWidth+'px'});
            }
        }
		var ajxpObject = this.getAndSetAjxpObject(this.selectedTabInfo);
		if(ajxpObject && !ajxpObject.fullScreenMode){
            var nodeElement = $(this.htmlElement).down("#"+this.selectedTabInfo.element);
            fitHeightToBottom(nodeElement, this.htmlElement, this.options.fitMarginBottom);
            ajxpObject.resize(nodeElement?nodeElement.getHeight():this.htmlElement.getHeight());
            var left = 0 ;
            var total = 0;
            var cont = this.htmlElement.down('div.tabulatorContainer');
            var innerWidth = parseInt(this.htmlElement.getWidth()) - parseInt(cont.getStyle('paddingLeft')) - parseInt(cont.getStyle('paddingRight'));
            if(this.options.headerToolbarOptions){
                var dBar = this.htmlElement.down('div#display_toolbar');
                innerWidth -= parseInt(dBar.getWidth()) + parseInt(dBar.getStyle('paddingRight'))  + parseInt(dBar.getStyle('paddingLeft'));
            }
            cont.removeClassName('icons_only');
            this.htmlElement.removeClassName('tabulator-vertical');
            this.tabulatorData.each(function(tabInfo){
                var header = tabInfo.headerElement;
                header.setStyle({width:'auto'});
                var hWidth = parseInt(header.getWidth());
                if(tabInfo == this.selectedTabInfo){
                    left = innerWidth - hWidth;
                }
                total += hWidth;
            }.bind(this));
            if(total >= innerWidth){
                var part = parseInt( left / ( this.tabulatorData.length -1) ) - 1 ;
                if(part < 14){
                    cont.addClassName('icons_only');
                }
                if(innerWidth < 30 ){
                    this.htmlElement.addClassName('tabulator-vertical');
                }
                this.tabulatorData.each(function(tabInfo){
                    var header = tabInfo.headerElement;
                    if(tabInfo != this.selectedTabInfo){
                        try{
                            header.setStyle({width:part - ( parseInt(header.getStyle('paddingRight')) + parseInt(header.getStyle('paddingLeft')) +  parseInt(header.getStyle('borderRightWidth'))  +  parseInt(header.getStyle('borderLeftWidth')) ) + 'px'});
                        }catch(e){}
                    }
                }.bind(this));
            }
        }
        document.fire("ajaxplorer:resize-AjxpTabulator-" + this.htmlElement.id, this.htmlElement.getDimensions());
        if(this.options.refireResize && !loop){
            window.setTimeout(function(){
                this.resize(size, true);
            }.bind(this), this.options.refireResize * 1000);
        }
	},

    showElement: function($super, show){
        if(!this.htmlElement) return;
        this.tabulatorData.each(function(tabInfo){
            var ajxpObject = this.getAndSetAjxpObject(tabInfo);
            ajxpObject.showElement(show);
        }.bind(this));

        if(show) {
            this.htmlElement.show();
            this.resize();
        } else {
            this.htmlElement.hide();
        }
    },

	/**
	 * Implementation of the IAjxpWidget methods
	 */
	getDomNode : function(){
		return this.htmlElement;
	},
	
	/**
	 * Implementation of the IAjxpWidget methods
	 */
	destroy : function(){
		this.tabulatorData.each(function(tabInfo){
			var ajxpObject = this.getAndSetAjxpObject(tabInfo);
			tabInfo.headerElement.stopObserving("click");
            if(Class.objectImplements(ajxpObject, "IFocusable")){
                pydio.UI.unregisterFocusable(ajxpObject);
            }
            if(Class.objectImplements(ajxpObject, "IActionProvider") && ajxpObject.getActions()){
                ajxpObject.getActions().each(function(act){
                    pydio.getController().deleteFromGuiActions(act.key);
                }.bind(this) );
            }
			ajxpObject.destroy();
		}.bind(this));
        if(this.tb){
            this.tb.destroy();
        }
        if(this.options.registerAsEditorOpener){
            pydio.UI.registerEditorOpener(this);
        }
        if(this.options.events){
            this.options.events.each(function(pair){
                document.stopObserving(pair.key, pair.value);
            });
        }

		this.htmlElement.update("");
        try{pydio.UI.removeInstanceFromCache(this.htmlElement.id);}catch(e){}
		this.htmlElement = null;
        if(this._routerObserver){
            pydio.stopObserving("routechange", this._routerObserver);
        }
	},
	
	
	/**
	 * Getter/Setter of the Widget that will be attached to each tabInfo
	 * @param tabInfo Object
	 * @returns IAjxpWidget
	 */
	getAndSetAjxpObject : function(tabInfo){
		var ajxpObject = tabInfo.ajxpObject || null;
        var nodeElement = $(tabInfo.element);
		if(nodeElement && nodeElement.ajxpPaneObject && (!ajxpObject || ajxpObject != nodeElement.ajxpPaneObject) ){
			ajxpObject = tabInfo.ajxpObject = nodeElement.ajxpPaneObject;
		}
		return ajxpObject;		
	},

    getAjxpObjectByTabId: function(tabId){
        var theInfo = this.tabulatorData.detect(function(tabInfo){
            if(tabInfo.id == tabId) return tabInfo;
        });
        if(theInfo) return this.getAndSetAjxpObject(theInfo);
        return null;
    },

    __stateLoaded : false,

    saveState: function(){
        if(!this.options.saveState || !this.__stateLoaded) return;
        if(!ajaxplorer.user) return;
        this.tabulatorData.each(function(tabInfo){
            var object = this.getAndSetAjxpObject(tabInfo);
            if(object.getStateData){
                if(!this.tabsConfigs.get(tabInfo.id)){
                    this.tabsConfigs.set(tabInfo.id, {});
                }
                this.tabsConfigs.get(tabInfo.id)['DATA'] = object.getStateData();
            }
        }.bind(this));
        // Clean tabsConfigs
        this.tabsConfigs.each(function(pair){
            var confPaneInfo = pair.value.PANE;
            if(confPaneInfo){
                if(confPaneInfo.editorData) {
                    confPaneInfo.editorID = confPaneInfo.editorData.id;
                    delete confPaneInfo['editorData'];
                }
                if(confPaneInfo.node){
                    confPaneInfo.nodePath = confPaneInfo.node.getPath();
                    delete confPaneInfo['node'];
                }
            }
        });
        this.setUserPreference("tabs_state", this.tabsConfigs);
    },

    loadState: function(){
        this.clearState();
        if(!ajaxplorer || !ajaxplorer.user) return;
        var pref = this.getUserPreference("tabs_state");
        if(pref){
            var index = 1;
            $H(pref).each(function(pair){
                if(pair.value.TAB && pair.value.PANE){
                    pair.value.TAB.dontFocus = true;
                    window.setTimeout(function(){
                        if(!$(this.htmlElement)) return;
                        this.addTab(Object.clone(pair.value.TAB), Object.clone(pair.value.PANE), true);
                        if(pair.value.DATA){
                            var object = this.getAjxpObjectByTabId(pair.key);
                            if(object && object.loadStateData) object.loadStateData(pair.value.DATA);
                        }
                    }.bind(this), index * 2000);
                    index ++;
                }else  if(pair.value.DATA){
                    var object = this.getAjxpObjectByTabId(pair.key);
                    if(object && object.loadStateData) object.loadStateData(pair.value.DATA);
                }
            }.bind(this));
        }
        this.__stateLoaded = true;
    },

    clearState: function(){
        this.tabulatorData.each(function(tabInfo){
            try{
                var ajxpObject = this.getAndSetAjxpObject(tabInfo);
                if(ajxpObject.clearStateData){
                    ajxpObject.clearStateData();
                }
                this.closeTab(tabInfo.id, true);
            }catch(e){

            }
        }.bind(this));
    }

});