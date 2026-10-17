/* A fixed, source-corroborated daily-close snapshot. No live feed or synthetic points. */
(function () {
    'use strict';

    const days = Object.freeze([
        { date: '2026-10-12', label: 'Mon', shortDate: '10/12' },
        { date: '2026-10-13', label: 'Tue', shortDate: '10/13' },
        { date: '2026-10-14', label: 'Wed', shortDate: '10/14' },
        { date: '2026-10-15', label: 'Thu', shortDate: '10/15' },
        { date: '2026-10-16', label: 'Fri', shortDate: '10/16' }
    ].map(Object.freeze));
    const stocks = Object.freeze([
        { symbol: 'GOOGL', name: 'Alphabet', closes: [352.72, 353.78, 347.64, 349.22, 340.59] },
        { symbol: 'AAPL', name: 'Apple', closes: [340.97, 341.27, 342.96, 342.00, 343.46] },
        { symbol: 'NVDA', name: 'NVIDIA', closes: [226.32, 228.52, 221.30, 217.23, 214.13] },
        { symbol: 'META', name: 'Meta Platforms', closes: [742.96, 762.50, 737.54, 736.72, 709.33] },
        { symbol: 'PLTR', name: 'Palantir', closes: [209.00, 208.67, 200.97, 200.50, 186.03] },
        { symbol: 'MSFT', name: 'Microsoft', closes: [541.15, 543.45, 533.69, 539.44, 529.05] },
        { symbol: 'AMD', name: 'Advanced Micro Devices', closes: [594.24, 605.53, 570.82, 562.23, 528.75] },
        { symbol: 'SPY', name: 'S&P 500 ETF', closes: [778.10, 778.01, 769.60, 771.79, 763.25] },
        { symbol: 'QQQ', name: 'NASDAQ-100 ETF', closes: [746.04, 743.57, 728.95, 728.00, 709.80] }
    ].map(stock => Object.freeze({
        ...stock,
        closes: Object.freeze(stock.closes),
        source: `https://stockanalysis.com/${['SPY', 'QQQ'].includes(stock.symbol) ? 'etf' : 'stocks'}/${stock.symbol.toLowerCase()}/history/`
    })));
    const provenance = 'Historical close snapshot';
    const colors = Object.freeze({ up: '#72d6a3', down: '#f18e86', flat: '#aab7c2' });
    const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const usd = value => `$${value.toFixed(2)}`;
    const signed = value => `${value > 0 ? '+' : value < 0 ? '\u2212' : ''}${Math.abs(value).toFixed(2)}`;
    const direction = difference => difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat';

    function changeFromMonday(closes) {
        const firstCents = Math.round(closes[0] * 100);
        const lastCents = Math.round(closes[closes.length - 1] * 100);
        return { amount: (lastCents - firstCents) / 100, percent: (lastCents - firstCents) / firstCents * 100 };
    }

    function makeAxis(closes) {
        if (!closes.length || closes.some(value => !Number.isFinite(value) || value <= 0)) throw new TypeError('Daily closes must be finite positive USD values.');
        const low = Math.min(...closes);
        const high = Math.max(...closes);
        const padding = Math.max((high - low) * .10, high * .0005, .01);
        const rawStep = (high - low + padding * 2) / 4;
        const magnitude = 10 ** Math.floor(Math.log10(rawStep));
        const multiple = [1, 2, 2.5, 5, 10].find(value => value >= rawStep / magnitude);
        let step = multiple * magnitude;
        const bounds = () => ({ min: Math.floor((low - padding) / step) * step, max: Math.ceil((high + padding) / step) * step });
        let { min, max } = bounds();
        while (Math.round((max - min) / step) < 3) {
            step /= 2;
            ({ min, max } = bounds());
        }
        min = Number(min.toFixed(8));
        max = Number(max.toFixed(8));
        const count = Math.round((max - min) / step);
        const ticks = Array.from({ length: count + 1 }, (_, index) => Number((min + index * step).toFixed(8)));
        return { min, max, step, ticks };
    }

    function makeChart(stock) {
        if (!stock || stock.closes.length !== days.length) throw new TypeError('A stock snapshot must contain exactly five daily closes.');
        const axis = makeAxis(stock.closes);
        const bounds = { left: 47, right: 286, top: 9, bottom: 79 };
        const points = stock.closes.map((close, index) => ({
            ...days[index], close,
            x: bounds.left + index / (days.length - 1) * (bounds.right - bounds.left),
            y: bounds.bottom - (close - axis.min) / (axis.max - axis.min) * (bounds.bottom - bounds.top)
        }));
        const segments = points.slice(1).map((point, index) => ({
            from: points[index], to: point,
            direction: direction(Math.round(point.close * 100) - Math.round(points[index].close * 100))
        }));
        return { stock, axis, bounds, points, segments, change: changeFromMonday(stock.closes) };
    }

    function chartMarkup(stock) {
        const model = makeChart(stock);
        const { axis, bounds, points, segments, change } = model;
        const latest = stock.closes[4];
        const trend = direction(change.amount);
        const y = value => bounds.bottom - (value - axis.min) / (axis.max - axis.min) * (bounds.bottom - bounds.top);
        const ticks = axis.ticks.map(value => `<g><path d="M${bounds.left} ${y(value).toFixed(2)}H${bounds.right}" class="fd-market-grid"/><text class="fd-market-y-tick" data-value="${value}" x="40" y="${y(value).toFixed(2)}" text-anchor="end" dominant-baseline="middle">${usd(value)}</text></g>`).join('');
        const dayLabels = points.map(point => `<text class="fd-market-x-tick" data-date="${point.date}" x="${point.x}" y="96" text-anchor="middle">${point.label}</text>`).join('');
        const lines = segments.map(segment => `<path class="fd-market-segment" data-direction="${segment.direction}" data-from="${segment.from.close.toFixed(2)}" data-to="${segment.to.close.toFixed(2)}" d="M${segment.from.x.toFixed(2)} ${segment.from.y.toFixed(2)}L${segment.to.x.toFixed(2)} ${segment.to.y.toFixed(2)}" fill="none" stroke="${colors[segment.direction]}" stroke-width="2" stroke-linecap="round"><title>${segment.from.label} to ${segment.to.label}: ${signed(segment.to.close - segment.from.close)} USD</title></path>`).join('');
        const dots = points.map((point, index) => `<circle class="fd-market-point" data-date="${point.date}" data-close="${point.close.toFixed(2)}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2.5" fill="${index ? colors[segments[index - 1].direction] : '#e2e9ed'}" stroke="#0c141a" stroke-width="1"><title>${point.label} ${point.shortDate}: ${usd(point.close)}</title></circle>`).join('');
        const priceList = points.map(point => `${point.label}, October ${Number(point.date.slice(-2))}: ${usd(point.close)}`).join('; ');
        const description = `${provenance}, not live data. Daily closing prices in USD, October 12 through 16, 2026. ${priceList}. Green segments rise from the previous daily close, red segments fall, and gray segments are unchanged. Mon–Fri change is Friday close minus Monday close, not a prior-Friday weekly return.`;
        return `<div class="fd-market-summary"><div><strong>${stock.symbol}</strong><span class="fd-market-latest">${usd(latest)}</span><small>Oct 12–16, 2026 · USD</small></div><div class="fd-market-performance is-${trend}"><strong>${signed(change.percent)}%</strong><small>Mon–Fri change</small></div></div><svg class="fd-market-svg" viewBox="0 0 300 108" role="img" aria-labelledby="fd-market-chart-title fd-market-chart-description"><title id="fd-market-chart-title">${stock.symbol} daily closes, October 12–16, 2026</title><desc id="fd-market-chart-description">${escapeHTML(description)}</desc>${ticks}<path class="fd-market-axis" d="M${bounds.left} ${bounds.top}V${bounds.bottom}H${bounds.right}"/>${dayLabels}${lines}${dots}</svg>`;
    }

    function init(root) {
        const list = root.querySelector('.fd-ticker-list');
        const chart = root.querySelector('.fd-terminal-chart');
        if (!list || !chart || list.dataset.marketReady === 'true') return null;
        const terminal = list.closest('.fd-terminal');
        if (!terminal) return null;
        list.dataset.marketReady = 'true';
        terminal.classList.add('fd-market-ready');
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', 'Select a stock to view its daily closing prices');
        chart.id = chart.id || 'fd-selected-stock-chart';
        chart.dataset.marketSnapshot = '2026-10-12/2026-10-16';
        // Keep the live region stable while replacing only the selected chart.
        const doc = list.ownerDocument || root;
        const status = doc.createElement('span');
        status.className = 'fd-market-status fd-sr-only';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        terminal.append(status);
        const buttons = [];
        let selected = null;
        function select(symbol, announce = true) {
            const stock = stocks.find(item => item.symbol === symbol);
            if (!stock || selected === symbol) return;
            selected = symbol;
            list.dataset.selectedSymbol = symbol;
            chart.dataset.symbol = symbol;
            buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.symbol === symbol)));
            chart.innerHTML = chartMarkup(stock);
            if (announce) {
                const change = changeFromMonday(stock.closes);
                status.textContent = `${stock.name}, ${symbol}. Friday close ${usd(stock.closes[4])}. Mon–Fri change ${signed(change.amount)} USD, ${signed(change.percent)} percent. Daily closes for October 12 through 16, 2026. ${provenance}.`;
            }
        }
        list.replaceChildren();
        stocks.forEach((stock, index) => {
            const change = changeFromMonday(stock.closes);
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'fd-ticker-row fd-stock-button';
            button.dataset.symbol = stock.symbol;
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-controls', chart.id);
            button.setAttribute('aria-label', `${stock.name}, ${stock.symbol}. Friday close ${usd(stock.closes[4])}. Mon–Fri change ${signed(change.percent)} percent. Show daily closing prices.`);
            button.innerHTML = `<strong>${stock.symbol}<small>${escapeHTML(stock.name)}</small></strong><span class="fd-ticker-price">${stock.closes[4].toFixed(2)}</span><span class="fd-ticker-change is-${direction(change.amount)}">${signed(change.percent)}%</span>`;
            button.addEventListener('click', () => select(stock.symbol));
            button.addEventListener('keydown', event => {
                let next = index;
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % buttons.length;
                else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = buttons.length - 1;
                else return; // Enter and Space retain native button activation.
                event.preventDefault();
                buttons[next].focus();
                select(buttons[next].dataset.symbol);
            });
            buttons.push(button);
            list.append(button);
        });
        select('GOOGL', false);
        return { select, buttons };
    }

    const api = Object.freeze({ days, stocks, provenance, colors, changeFromMonday, makeAxis, makeChart, chartMarkup, init });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document !== 'undefined') init(document);
})();
