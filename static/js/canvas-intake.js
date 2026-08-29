(function(global){
    'use strict';

    const STORAGE_KEY = 'qcos_canvas_intake_items';
    const QUEUE_VERSION = 1;
    const MAX_ITEMS = 100;
    const QUEUE_EVENT = 'qcos:canvas-intake';
    const STATUS_EVENT = 'qcos:canvas-intake-status';
    const STATUS_VALUES = new Set(['queued', 'saving', 'succeeded', 'failed', 'cancelled']);

    function emptyQueue(){
        return {version:QUEUE_VERSION, batches:[]};
    }

    function hashText(value){
        let hash = 0x811c9dc5;
        const text = String(value || '');
        for(let index = 0; index < text.length; index += 1){
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(36).padStart(7, '0');
    }

    function normalizeItem(value){
        if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const url = String(value.url || '').trim();
        if(!url) return null;
        const item = {...value, url, type:value.type === 'output' ? 'output' : 'image'};
        if(item.id != null) item.id = String(item.id).trim();
        ['title','prompt','source','model'].forEach(key => {
            if(item[key] != null) item[key] = String(item[key]);
        });
        ['width','height'].forEach(key => {
            if(item[key] == null || item[key] === '') return;
            const numeric = Number(item[key]);
            if(Number.isFinite(numeric)) item[key] = numeric;
            else delete item[key];
        });
        return item;
    }

    function normalizeItems(values){
        return (Array.isArray(values) ? values : []).map(normalizeItem).filter(Boolean);
    }

    function normalizeStoredItems(values, label){
        if(!Array.isArray(values)) throw new Error(`${label} 的 items 必须是数组`);
        const items = values.map(normalizeItem);
        if(items.some(item => !item)) throw new Error(`${label} 包含无效素材`);
        return items;
    }

    function stableBatchId(createdAt, items){
        return `legacy-${hashText(`${Number(createdAt) || 0}|${JSON.stringify(items)}`)}`;
    }

    function createBatchId(){
        try {
            if(global.crypto?.randomUUID) return global.crypto.randomUUID();
        } catch(e){}
        return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizeBatch(value, index=0){
        if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`批次 ${index + 1} 无效`);
        const createdAt = Number(value.created_at) || 0;
        const items = normalizeStoredItems(value.items, `批次 ${index + 1}`);
        const id = String(value.id || '').trim();
        if(!id) throw new Error(`批次 ${index + 1} 缺少 id`);
        return {id, created_at:createdAt, items};
    }

    function normalizeQueue(value){
        if(!value || !Array.isArray(value.batches)) throw new Error('待放置素材 batches 必须是数组');
        const batches = value.batches.map(normalizeBatch);
        const ids = batches.map(batch => batch.id);
        if(new Set(ids).size !== ids.length) throw new Error('待放置素材包含重复批次 id');
        return {version:QUEUE_VERSION, batches};
    }

    function totalItems(queue){
        return (queue?.batches || []).reduce((total, batch) => total + (Array.isArray(batch?.items) ? batch.items.length : 0), 0);
    }

    function readQueue(){
        let raw = '';
        try {
            raw = global.localStorage.getItem(STORAGE_KEY) || '';
        } catch(error) {
            return {ok:false, queue:emptyQueue(), raw:'', error:`无法读取待放置素材：${error?.message || error}`};
        }
        if(!raw) return {ok:true, queue:emptyQueue(), raw:'', migrated:false, error:''};
        try {
            const parsed = JSON.parse(raw);
            let queue;
            let migrated = false;
            if(parsed?.version === QUEUE_VERSION && Array.isArray(parsed.batches)){
                queue = normalizeQueue(parsed);
            } else if(parsed && Array.isArray(parsed.items)) {
                const createdAt = Number(parsed.created_at) || 0;
                const items = normalizeStoredItems(parsed.items, '旧版待放置素材');
                queue = {version:QUEUE_VERSION, batches:items.length ? [{id:stableBatchId(createdAt, items), created_at:createdAt, items}] : []};
                migrated = true;
            } else {
                throw new Error('待放置素材结构无效');
            }
            const count = totalItems(queue);
            if(count > MAX_ITEMS) throw new Error(`待放置素材超过 ${MAX_ITEMS} 项上限`);
            return {ok:true, queue, raw, migrated, error:''};
        } catch(error) {
            return {ok:false, queue:emptyQueue(), raw, migrated:false, error:`待放置素材损坏：${error?.message || error}`};
        }
    }

    function writeQueue(queue){
        let normalized;
        try {
            normalized = normalizeQueue(queue);
        } catch(error) {
            return {ok:false, queue:emptyQueue(), error:`无法保存待放置素材：${error?.message || error}`};
        }
        if(totalItems(normalized) > MAX_ITEMS){
            return {ok:false, queue:normalized, error:`待放置素材总数不能超过 ${MAX_ITEMS} 项`};
        }
        try {
            if(normalized.batches.length) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            else global.localStorage.removeItem(STORAGE_KEY);
            return {ok:true, queue:normalized, error:''};
        } catch(error) {
            return {ok:false, queue:normalized, error:`无法保存待放置素材：${error?.message || error}`};
        }
    }

    function emitQueue(detail){
        try { global.dispatchEvent(new CustomEvent(QUEUE_EVENT, {detail})); } catch(e){}
    }

    function notifyStatus(payload){
        const status = String(payload?.status || '');
        if(!STATUS_VALUES.has(status)) return false;
        const message = {
            type:'canvas-intake-status',
            status,
            batch_ids:Array.isArray(payload?.batch_ids) ? payload.batch_ids.map(String) : [],
            item_count:Math.max(0, Number(payload?.item_count) || 0),
            detail:String(payload?.detail || '')
        };
        try { global.dispatchEvent(new CustomEvent(STATUS_EVENT, {detail:message})); } catch(e){}
        const targetOrigin = global.location.origin;
        try { if(global.parent && global.parent !== global) global.parent.postMessage(message, targetOrigin); } catch(e){}
        try { if(global.top && global.top !== global && global.top !== global.parent) global.top.postMessage(message, targetOrigin); } catch(e){}
        return true;
    }

    function appendBatch(values){
        const items = normalizeItems(values);
        if(!items.length) return {ok:false, items:[], error:'没有可发送的待放置素材'};
        const current = readQueue();
        if(!current.ok) return {ok:false, items, error:current.error, queue:current.queue};
        const nextCount = totalItems(current.queue) + items.length;
        if(nextCount > MAX_ITEMS){
            return {ok:false, items, queue:current.queue, error:`待放置素材总数不能超过 ${MAX_ITEMS} 项`};
        }
        const batch = {id:createBatchId(), created_at:Date.now(), items};
        const queue = {version:QUEUE_VERSION, batches:[...current.queue.batches, batch]};
        const saved = writeQueue(queue);
        if(!saved.ok) return {ok:false, items, batch, queue:current.queue, error:saved.error};
        const result = {ok:true, items, batch, queue:saved.queue, error:''};
        emitQueue(result);
        notifyStatus({status:'queued', batch_ids:[batch.id], item_count:items.length, detail:'Canvas intake queued'});
        return result;
    }

    function clearBatches(batchIds){
        const ids = new Set((batchIds || []).map(String));
        const current = readQueue();
        if(!current.ok) return {ok:false, queue:current.queue, cleared:[], error:current.error};
        const cleared = current.queue.batches.filter(batch => ids.has(batch.id));
        const queue = {version:QUEUE_VERSION, batches:current.queue.batches.filter(batch => !ids.has(batch.id))};
        const saved = writeQueue(queue);
        if(!saved.ok) return {ok:false, queue:current.queue, cleared:[], error:saved.error};
        const result = {ok:true, queue:saved.queue, cleared, error:''};
        emitQueue(result);
        return result;
    }

    function clearAll(){
        const current = readQueue();
        try {
            global.localStorage.removeItem(STORAGE_KEY);
        } catch(error) {
            return {ok:false, queue:current.queue, cleared:[], error:`无法清空待放置素材：${error?.message || error}`};
        }
        const cleared = current.ok ? current.queue.batches : [];
        const result = {ok:true, queue:emptyQueue(), cleared, error:''};
        emitQueue(result);
        return result;
    }

    function countItems(value){
        const queue = value?.queue || value || readQueue().queue;
        return totalItems(queue);
    }

    function itemKey(batchId, item, index=0){
        const explicit = String(item?.id || '').trim();
        const identity = explicit || `item-${hashText(JSON.stringify(normalizeItem(item) || {}))}`;
        return `${String(batchId || 'batch')}:${identity}:${Math.max(0, Number(index) || 0)}`;
    }

    global.QCOSCanvasIntake = Object.freeze({
        STORAGE_KEY,
        QUEUE_VERSION,
        MAX_ITEMS,
        QUEUE_EVENT,
        STATUS_EVENT,
        readQueue,
        writeQueue,
        appendBatch,
        countItems,
        clearBatches,
        clearAll,
        itemKey,
        notifyStatus,
        normalizeItems
    });
})(window);
