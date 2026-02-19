
export function showToast(msg, type) {
    const toast = document.getElementById('toast');
    const txt = document.getElementById('toast-msg');
    const dot = document.getElementById('toast-dot');

    if (txt) txt.innerText = msg;
    if (dot) dot.className = 'status-dot ' + type;

    if (toast) {
        toast.classList.add('active');
        setTimeout(() => {
            if (type !== 'loading') toast.classList.remove('active');
        }, 3000);
    }
}

export function debounce(func, wait) {
    let timeout;
    return functionExecutedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
