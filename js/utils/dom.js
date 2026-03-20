export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') element.className = val;
    else if (key === 'textContent') element.textContent = val;
    else if (key === 'innerHTML') element.innerHTML = val;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
    else element.setAttribute(key, val);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === 'string') element.appendChild(document.createTextNode(child));
    else if (child) element.appendChild(child);
  }
  return element;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function clearEl(element) {
  element.innerHTML = '';
}

export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const view = document.getElementById(`view-${viewId}`);
  if (view) view.style.display = 'block';
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}
