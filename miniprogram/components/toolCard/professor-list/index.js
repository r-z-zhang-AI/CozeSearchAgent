Component({
  properties: {
    name: {
      type: String,
      value: "",
    },
    toolData: {
      type: Object,
      value: {},
    },
    toolParams: {
      type: Object,
      value: {},
    },
    // 新增：直接接收扣子工作流返回的 card_data
    cardData: {
      type: Object,
      value: null,
    },
    // 新增：只读模式，用于分享页面
    readOnly: {
      type: Boolean,
      value: false,
    },
    // 新增：多选模式
    multiSelectMode: {
      type: Boolean,
      value: false,
    },
    // 新增：消息是否被选中
    messageSelected: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    candidates: [],
  },
  lifetimes: {
    attached: function() {
      // 兼容两种来源：1) 旧版 toolData.content；2) 新版 cardData
      this.tryInitFromToolData(this.data.toolData);
      this.tryInitFromCardData(this.data.cardData);
      
      // 监听收藏状态变更事件
      const self = this;
      this._onFavoriteChanged = function(e) {
        self.refreshFavoriteStates();
      };
      wx.$on && wx.$on('favoriteChanged', this._onFavoriteChanged);
    },
    detached: function() {
      // 清理事件监听
      wx.$off && wx.$off('favoriteChanged', this._onFavoriteChanged);
    },
  },
  observers: {
    // 属性变更时也同步
    toolData: function(val) {
      this.tryInitFromToolData(val);
    },
    cardData: function(val) {
      this.tryInitFromCardData(val);
    },
  },
  methods: {
    normPercent: function(n) {
      if (n === undefined || n === null) return 0;
      const x = Number(n);
      if (Number.isNaN(x)) return 0;
      // 如果是 0-1 小数，转百分比；如果是 0-100 直接四舍五入
      if (x <= 1) return Math.round(Math.max(0, Math.min(1, x)) * 100);
      return Math.round(Math.max(0, Math.min(100, x)));
    },
    decorate: function(list) {
      const self = this;
      return (list || []).map(function(c, index) {
        const result = Object.assign({}, c, {
          displayScore: self.normPercent(c.displayScore !== undefined ? c.displayScore : c.score),
          isFav: !!c.isFav,
          uniqueKey: c.uniqueKey || ('prof_dec_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 6))
        });

        return result;
      });
    },
    tryInitFromToolData: function(toolData) {
      try {
        const content = (toolData || {}).content;
        if (Array.isArray(content) && content[0] && content[0].type === "text") {
          const payload = JSON.parse(content[0].text);
          const candidates = (payload || {}).candidates || [];
          const decorated = this.decorate(candidates);
          this.setData({ candidates: decorated });
        }
      } catch (e) {
        console.log("professor-list parse error (toolData)", e);
      }
    },
    tryInitFromCardData: function(cardData) {
      try {
        if (!cardData || typeof cardData !== 'object') return;
        // 期待结构：{ type: 'professor_list', professors: [...] }
        const type = cardData.type;
        const professors = cardData.professors;
        if (type === 'professor_list' && Array.isArray(professors)) {
          // 获取已收藏的教授列表
          const favorites = wx.getStorageSync('favorites') || [];
          const favSet = new Set(favorites.map(function(f) { return f.profId; }));
          
          // 首先检测重复的profId
          const usedIds = new Set();
          const mapped = (professors || []).map(function(p, index) {
            let originalProfId = p.profId || p.documentId || '';
            let profId = originalProfId;
            
            // 如果ID为空或已被使用，生成新的唯一ID
            if (!profId || usedIds.has(profId)) {
              profId = originalProfId + '_' + index + '_' + Math.random().toString(36).substr(2, 6);
            }
            
            usedIds.add(profId);
            
            return {
              profId: profId,
              uniqueKey: 'prof_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 8), // 确保每个条目有唯一key
              name: p.name || '',
              school: p.school || '',
              areas: Array.isArray(p.areas) ? p.areas : [],
              email: p.email || '',
              homepage: p.homepage || '',
              highlights: Array.isArray(p.highlights) ? p.highlights : [],
              score: p.score,
              displayScore: p.displayScore !== undefined ? p.displayScore : p.score,
              isFav: favSet.has(originalProfId), // 使用原始ID检查收藏状态
            };
          });
          this.setData({ candidates: this.decorate(mapped) });
        }
      } catch (e) {
        console.log("professor-list parse error (cardData)", e);
      }
    },
    onFavorite: function(e) {
      const dataset = e.currentTarget.dataset || {};
      const profId = dataset.id;
      const index = parseInt(dataset.index);
      

      
      if (!profId || isNaN(index) || index < 0 || index >= this.data.candidates.length) {
        console.error('Invalid profId or index:', { profId, index, length: this.data.candidates.length });
        return;
      }
      
      // 完全重新构建数组，确保每个对象都是新的引用
      const newCandidates = this.data.candidates.map((prof, i) => {
        if (i === index && prof.profId === profId) {
          // 只修改目标教授的收藏状态
          const newProf = Object.assign({}, prof, { 
            isFav: !prof.isFav 
          });
          
          return newProf;
        } else {
          // 其他教授保持原状但创建新对象引用
          return Object.assign({}, prof);
        }
      });
      
             // 强制更新UI
       this.setData({ 
         candidates: newCandidates 
       });
      
      const newFavState = newCandidates[index].isFav;
      
      // 处理本地存储和云端同步
      try {
        const existed = wx.getStorageSync('favorites') || [];
        const favMap = new Map(existed.map(function(x) { return [x.profId, x]; }));
        
        if (newFavState) {
          // 添加到收藏
          const profData = Object.assign({}, newCandidates[index], { updatedAt: Date.now() });
          favMap.set(profId, profData);
          
          // 云端添加
          wx.cloud.callFunction({ 
            name: 'favorites', 
            data: { 
              action: 'add', 
              prof: profData
            } 
          }).catch(err => console.error('Cloud add failed:', err));
        } else {
          // 从收藏移除
          favMap.delete(profId);
          
          // 云端移除
          wx.cloud.callFunction({ 
            name: 'favorites', 
            data: { 
              action: 'remove', 
              profId: profId 
            } 
          }).catch(err => console.error('Cloud remove failed:', err));
        }
        
        wx.setStorageSync('favorites', Array.from(favMap.values()));
        
      } catch (err) {
        console.error('Storage error:', err);
      }
      
      // 简单的点击反馈通过CSS处理
      
      wx.showToast({ 
        title: newFavState ? "已收藏" : "已取消", 
        icon: "success" 
      });
      
      // 发送全局事件通知其他组件更新  
      wx.$emit && wx.$emit('favoriteChanged', { profId, isFav: newFavState });
    },
    
    // 复制邮箱到剪贴板
    copyToClipboard: function(e) {
      const text = e.currentTarget.dataset.text;
      if (text) {
        wx.setClipboardData({
          data: text,
          success: function() {
            wx.showToast({
              title: '已复制到剪贴板',
              icon: 'success'
            });
          },
          fail: function() {
            wx.showToast({
              title: '复制失败',
              icon: 'none'
            });
          }
        });
      }
    },
    
    // 打开个人主页
    openHomepage: function(e) {
      const url = e.currentTarget.dataset.url;
      if (url) {
        // 小程序中打开外部链接需要使用 web-view 或复制链接
        wx.setClipboardData({
          data: url,
          success: function() {
            wx.showModal({
              title: '主页链接已复制',
              content: '链接已复制到剪贴板，请在浏览器中打开',
              showCancel: false,
              confirmText: '我知道了'
            });
          },
          fail: function() {
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            });
          }
        });
      }
    },
    
    // 刷新收藏状态
    refreshFavoriteStates: function() {
      const favorites = wx.getStorageSync('favorites') || [];
      const favSet = new Set(favorites.map(function(f) { return f.profId; }));
      
      const candidates = this.data.candidates.map(function(prof) {
        return Object.assign({}, prof, {
          isFav: favSet.has(prof.profId)
        });
      });
      
      this.setData({ candidates: candidates });
    },

    // 教授分享功能
    onProfessorShare: function(e) {
      const prof = e.currentTarget.dataset.prof;
      if (!prof) return;

      // 生成教授分享数据
      const shareData = {
        type: 'professor',
        professor: {
          name: prof.name,
          school: prof.school,
          areas: prof.areas,
          email: prof.email,
          office: prof.office,
          phone: prof.phone,
          homepages: prof.homepages,
          highlights: prof.highlights,
          score: prof.displayScore
        },
        timestamp: Date.now()
      };

      // 生成分享链接
      const shareUrl = `https://your-domain.com/professor?data=${encodeURIComponent(JSON.stringify(shareData))}`;

      wx.showActionSheet({
        itemList: ['微信分享', '复制分享链接', '收藏教授'],
        success: (res) => {
          switch(res.tapIndex) {
            case 0: // 微信分享
              wx.shareAppMessage({
                title: `推荐教授：${prof.name}`,
                path: `/pages/professor/professor?data=${encodeURIComponent(JSON.stringify(shareData))}`,
                success: () => {
                  wx.showToast({ title: '分享成功', icon: 'success' });
                }
              });
              break;
            case 1: // 复制链接
              wx.setClipboardData({
                data: shareUrl,
                success: () => {
                  wx.showToast({ title: '链接已复制', icon: 'success' });
                }
              });
              break;
            case 2: // 收藏教授
              this.onFavorite(e);
              break;
          }
        }
      });
    },
  },
}); 