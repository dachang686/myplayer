// Poster navigation, upload, and sharing.

// ── 查看其他用户建模 ──
function viewOtherBuilds() {
  console.log('👥 viewOtherBuilds 被点击');
  console.log('  POSTER_TAG_ID:', POSTER_TAG_ID);
  var url = 'huputiyu://bbs/topicTag?tagId=' + POSTER_TAG_ID;
  console.log('  拼接URL:', url);
  console.log('  ColorboxAI 是否存在:', !!window.ColorboxAI);
  console.log('  navigateTo 是否可用:', typeof (window.ColorboxAI && window.ColorboxAI.navigateTo));
  console.log('  openUrl 是否可用:', typeof (window.ColorboxAI && window.ColorboxAI.openUrl));
  if (window.ColorboxAI && typeof window.ColorboxAI.navigateTo === 'function') {
    console.log('  → 调用 ColorboxAI.navigateTo');
    window.ColorboxAI.navigateTo(url, '_self');
  } else if (window.ColorboxAI && typeof window.ColorboxAI.openUrl === 'function') {
    console.log('  → 调用 ColorboxAI.openUrl');
    window.ColorboxAI.openUrl(url);
  } else {
    console.warn('  ⚠️ ColorboxAI 跳转API不可用，无法跳转');
  }
  console.log('  → 关闭海报');
  closePoster();
}

// ── OSS 上传 ──
function dataURLToBlob(dataURL) {
  var parts = dataURL.split(',');
  var mime = parts[0].match(/:(.*?);/)[1];
  var bytes = atob(parts[1]);
  var ab = new ArrayBuffer(bytes.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i);
  return new Blob([ab], { type: mime });
}

function uploadToOSS(file, filename) {
  return new Promise(function(resolve, reject) {
    // 方案1: ColorboxAI
    if (window.ColorboxAI && window.ColorboxAI.oss && typeof window.ColorboxAI.oss.uploadFile === 'function') {
      window.ColorboxAI.oss.uploadFile({ file: file, filename: filename })
        .then(function(res) { resolve(res.downloadUrl || ''); })
        .catch(reject);
      return;
    }
    // 方案2: postMessage Bridge
    if (window.parent && window.parent !== window) {
      var callbackId = '_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      var timer = setTimeout(function() { cleanup(); reject(new Error('上传超时')); }, 30000);
      var handler = function(e) {
        var d = e.data;
        if (d && d.protocol === 'colorbox-ai-bridge' && d.type === 'oss.upload.callback' && d.payload && d.payload.callbackId === callbackId) {
          clearTimeout(timer); cleanup();
          d.payload.error ? reject(new Error(d.payload.error)) : resolve(d.payload.downloadUrl || '');
        }
      };
      var cleanup = function() { window.removeEventListener('message', handler); };
      window.addEventListener('message', handler);
      window.parent.postMessage({
        protocol: 'colorbox-ai-bridge', version: 1, direction: 'frame-to-host',
        type: 'oss.upload',
        payload: { file: file, filename: filename, callbackId: callbackId }
      }, '*');
      return;
    }
    // 方案3: 直连 KaleidoOSS
    var client = getOssClient();
    if (client) {
      var ext = filename.lastIndexOf('.') >= 0 ? filename.slice(filename.lastIndexOf('.')) : '.png';
      var now = new Date();
      var key = 'user-upload/' + (now.getFullYear() % 100) + (now.getMonth() + 1) + now.getDate() + '-' + Math.random().toString(36).slice(-6) + ext;
      client.multipartUpload(key, file, {})
        .then(function(res) { resolve(res.downloadUrl || 'https://activity-static.hoopchina.com.cn/' + res.name); })
        .catch(reject);
      return;
    }
    reject(new Error('No upload capability'));
  });
}

function safeNavigate(url, target) {
  if (window.ColorboxAI && typeof window.ColorboxAI.navigateTo === 'function') {
    try { window.ColorboxAI.navigateTo(url, target || '_blank'); return; } catch(e) {}
  }
  if (window.ColorboxAI && typeof window.ColorboxAI.openUrl === 'function') {
    try { window.ColorboxAI.openUrl(url); return; } catch(e) {}
  }
}

async function sharePoster(btn) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC14",label:"一键发帖"});
  var dataURLs = (window._posterDataURLs && window._posterDataURLs.length) ? window._posterDataURLs : [window._posterDataURL];
  dataURLs = dataURLs.filter(function(url) { return !!url; });
  if (!dataURLs.length) return;

  var origText = btn.innerHTML;
  btn.innerHTML = '⏳ 上传中...';
  btn.disabled = true;

  try {
    var imageList = [];
    for (var i = 0; i < dataURLs.length; i++) {
      var blob = dataURLToBlob(dataURLs[i]);
      if (blob.size === 0) { alert('海报图片为空'); return; }
      var filename = 'buildplayer_' + Date.now() + '_' + (i + 1) + '.png';
      var imageUrl = await uploadToOSS(blob, filename);
      if (imageUrl) imageList.push(imageUrl);
    }
    var initialValue = {
      syncPost: true,
      appJsonV3: {
        activeTab: 'thread',
        data: {
          title: '',
          imageList: imageList,
          content: ''
        }
      }
    };

    var postUrl = 'huputiyu://bbs/postImg?tagName=' + encodeURIComponent(POSTER_TAG_NAME) +
      '&tagId=' + POSTER_TAG_ID +
      '&topicName=' + encodeURIComponent(POSTER_TOPIC_NAME) +
      '&topicId=' + POSTER_TOPIC_ID +
      '&initialValue=' + encodeURIComponent(JSON.stringify(initialValue));
    safeNavigate(postUrl, '_self');
    closePoster();
  } catch (e) {
    console.warn('上传失败, 降级为纯文字发帖', e);
    var fallback = {
      syncPost: true,
      appJsonV3: {
        activeTab: 'thread',
        data: { title: '', imageList: [], content: '' }
      }
    };
    var fallbackUrl = 'huputiyu://bbs/postImg?tagName=' + encodeURIComponent(POSTER_TAG_NAME) +
      '&tagId=' + POSTER_TAG_ID +
      '&topicName=' + encodeURIComponent(POSTER_TOPIC_NAME) +
      '&topicId=' + POSTER_TOPIC_ID +
      '&initialValue=' + encodeURIComponent(JSON.stringify(fallback));
    safeNavigate(fallbackUrl, '_self');
    closePoster();
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

