Page({
  data: {
    favorites: [],
    list: [],
    keyword: '',
    activeTag: '全部',
    allTags: [],
    sortBy: 'time',
    order: 'desc',
  },
  onShow() {
    this.loadFavorites();
  },
  onInput(e){
    this.setData({ keyword: e.detail.value });
  },
  onSearch(){
    this.applyFilter();
  },
  onTagTap(e){
    const tag = e.currentTarget.dataset.tag;
    this.setData({ activeTag: tag }, () => this.applyFilter());
  },
  async loadFavorites(){
    try {
      // 先从本地兜底
      let favs = wx.getStorageSync('favorites') || [];
      // 再从云端拉取
      const res = await wx.cloud.callFunction({ name: 'favorites', data: { action: 'list', sortBy: this.data.sortBy, order: this.data.order } });
      if (res && res.result && res.result.code === 0) {
        favs = res.result.data || favs;
      }
      const tags = Array.from(new Set((favs||[]).flatMap(i => i.areas||[])));
      this.setData({ favorites: favs, allTags: tags }, () => this.applyFilter());
    } catch (e) {
      this.setData({ favorites: [], list: [], allTags: [] });
    }
  },
  applyFilter(){
    const { favorites, keyword, activeTag, sortBy, order } = this.data;
    const kw = (keyword || '').trim();
    const filtered = (favorites||[]).filter(item => {
      const tagOk = activeTag==='全部' || (item.areas||[]).includes(activeTag);
      if (!tagOk) return false;
      if (!kw) return true;
      const hay = `${item.name} ${item.school} ${(item.areas||[]).join(' ')}`;
      return hay.toLowerCase().includes(kw.toLowerCase());
    });
    const arr = filtered.sort((a,b)=>{
      if (sortBy==='score') return (order==='asc'?1:-1)*((a.displayScore||a.score||0)-(b.displayScore||b.score||0));
      // time: 后写入的认为更新更近
      return (order==='asc'?1:-1)*((a.updatedAt||0)-(b.updatedAt||0));
    });
    this.setData({ list: arr });
  },
  async onDelete(e){
    const profId = e.currentTarget.dataset.id;
    try{
      await wx.cloud.callFunction({ name: 'favorites', data: { action: 'remove', profId } });
    }catch(err){}
    // 本地同步
    const left = (this.data.favorites||[]).filter(i=>i.profId!==profId);
    wx.setStorageSync('favorites', left);
    this.setData({ favorites: left }, ()=> this.applyFilter());
    
    // 发送全局事件，通知其他页面更新星星状态
    wx.$emit && wx.$emit('favoriteChanged', { profId, isFav: false });
  },
  onSort(e){
    this.setData({ sortBy: 'time' }, ()=> this.loadFavorites());
  }
}); 