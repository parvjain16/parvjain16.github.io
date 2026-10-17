/* Screenshot-inspired local Google Finance view. No accounts, feeds, AI calls or trades. */
(function () {
    'use strict';
    const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const watchlist = Object.freeze([
        { symbol: 'AAPL', name: 'Apple Inc', price: '343.46', change: '+0.43%' },
        { symbol: 'AFRM', name: 'Affirm Holdings Inc', price: '74.01', change: '−2.52%' },
        { symbol: 'AMZN', name: 'Amazon.com Inc', price: '250.00', change: '−1.87%' },
        { symbol: 'GOOGL', name: 'Alphabet Inc Class A', price: '340.59', change: '−2.47%' },
        { symbol: 'LITE', name: 'Lumentum Holdings Inc', price: '824.13', change: '−5.22%' },
        { symbol: 'META', name: 'Meta Platforms Inc', price: '709.33', change: '−3.72%' },
        { symbol: 'MSFT', name: 'Microsoft Corp', price: '529.05', change: '−1.93%' },
        { symbol: 'NFLX', name: 'Netflix Inc', price: '70.53', change: '−2.86%' },
        { symbol: 'NVDA', name: 'NVIDIA Corp', price: '214.13', change: '−1.43%' },
        { symbol: 'TGT', name: 'Target Corp', price: '154.26', change: null }
    ].map(Object.freeze));
    const indices = Object.freeze([
        { id: 'dow', name: 'Dow Jones', value: '52,002.41', amount: '−175.28', change: '−0.34%', direction: 'down' },
        { id: 'sp500', name: 'S&P 500', value: '7,659.44', amount: '−84.62', change: '−1.09%', direction: 'down' },
        { id: 'nasdaq', name: 'Nasdaq', value: '26,140.03', amount: '−572.99', change: '−2.14%', direction: 'down' },
        { id: 'russell', name: 'Russell', value: '2,721.37', amount: '−45.90', change: '−1.66%', direction: 'down' },
        { id: 'vix', name: 'VIX', value: '19.99', amount: '+3.53', change: '+21.45%', direction: 'up' }
    ].map(Object.freeze));
    const regions = Object.freeze(['US', 'Europe', 'Asia', 'Latin America', 'Currencies', 'Crypto', 'Futures']);
    const questions = Object.freeze([
        'What happened in the markets on Friday?',
        'How did tech stocks perform on Friday?',
        'What moved gold on Friday?'
    ]);
    const icon = (paths, className = '') => `<svg class="fd-gf-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
    const icons = {
        search: icon('<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>'),
        sparkle: icon('<path d="m17 2 1.7 4.3L23 8l-4.3 1.7L17 14l-1.7-4.3L11 8l4.3-1.7Z"/><path d="M11 5a7 7 0 1 0 4 12l5 5"/>'),
        trend: icon('<path d="m3 18 6-7 4 3 7-9M16 5h4v4"/><path d="m9 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>'),
        plus: icon('<path d="M12 5v14M5 12h14"/>'),
        chevron: icon('<path d="m8 5 7 7-7 7"/>'),
        close: icon('<path d="m6 6 12 12M6 18 12-12"/>'),
        new: icon('<path d="M12 5H4v15h15v-8M10 14l1-5 8-8 4 4-8 8Z"/>'),
        task: icon('<circle cx="11" cy="12" r="8"/><path d="m6 12 4 4L21 5"/>'),
        send: icon('<path d="M12 20V4M5 11l7-7 7 7"/>'),
        mic: icon('<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4"/>'),
        gear: icon('<path d="m10 2-.7 3-2.3 1-2.7-.8-2 3.5 2.1 2.1v2.5L2.3 15l2 3.5 2.7-.8 2.3 1 .7 3h4l.7-3 2.3-1 2.7.8 2-3.5-2.1-1.7v-2.5l2.1-2.1-2-3.5-2.7.8-2.3-1L14 2Z"/><circle cx="12" cy="12" r="3"/>'),
        feedback: icon('<path d="M3 3h18v14H8l-5 4ZM12 7v5M12 14h.01"/>'),
        broadcast: icon('<circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9M4.5 4.5a10.5 10.5 0 0 0 0 15M19.5 4.5a10.5 10.5 0 0 1 0 15"/>')
    };
    // These are decorative reference shapes, not reconstructed intraday observations.
    const paths = [
        'M0 10 4 5 8 8 12 6 16 10 20 9 24 11 29 10 34 15 40 14 46 17 52 20 58 19 64 26 70 24 75 27 80 21 85 25 90 26 96 25 102 28 109 27 115 28 120 24',
        'M0 5 5 7 9 5 15 8 21 7 27 11 33 10 39 14 45 13 51 19 57 17 63 22 69 21 76 24 82 23 89 27 95 25 101 28 108 26 114 28 120 25',
        'M0 8 7 9 12 7 18 10 25 8 31 12 37 12 43 16 49 15 56 18 62 20 68 19 74 22 80 23 86 26 92 25 98 27 104 25 112 28 120 26',
        'M0 7 6 6 11 9 18 8 25 12 31 13 38 17 45 17 51 21 58 21 64 23 70 25 77 28 84 26 90 28 98 28 106 27 113 27 120 28',
        'M0 28 8 27 15 29 24 27 33 26 41 24 49 22 57 18 63 7 67 20 71 16 75 4 80 11 85 8 91 12 97 10 103 13 109 11 115 13 120 12'
    ];
    const sparkline = index => `<svg class="fd-gf-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="fd-gf-spark-fill" d="${paths[index]} L120 32H0Z"/><path class="fd-gf-spark-line" d="${paths[index]}"/></svg>`;

    function filterWatchlist(query) {
        const needle = String(query || '').trim().toLowerCase();
        return watchlist.filter(stock => `${stock.symbol} ${stock.name}`.toLowerCase().includes(needle));
    }
    function researchReply(question) {
        const input = String(question).toLowerCase();
        // Dated editorial briefs, not a connected AI service. Reporting checked 2026-10-17:
        // AP: https://apnews.com/article/d2655f64db7ec8ae450525d58f97b628
        // Reuters: https://www.brecorder.com/news/amp/40444523 (Friday morning, not closing prices).
        // Individual stock changes below are the saved watchlist figures above.
        if (/\bgold\b/.test(input)) return 'Gold edged higher early on Friday, October 16 as the dollar softened. Reuters reported spot gold up 0.2% at $4,177.82 an ounce at 04:33 GMT, but still down 0.5% for the week at that point. Investors were weighing inflation and the Federal Reserve’s rate outlook. Those were morning prices, not the final close.';
        if (/\b(?:nasdaq|tech stocks|technology)\b/.test(input)) return 'Technology shares were under pressure on Friday, October 16. The Nasdaq fell about 2.1% as a broad tech selloff weighed on the market. In this watchlist, Meta fell 3.72%, Alphabet 2.47%, Microsoft 1.93%, and NVIDIA 1.43%, while Apple rose 0.43%. These are individual stock moves, not a ranking of their contributions to the index.';
        if (/\b(?:lite|lumentum)\b/.test(input)) return 'Lumentum closed at $824.13 in this Friday snapshot, down 5.22%. Its decline was larger than the Nasdaq’s roughly 2.1% drop. That comparison shows the size of the move; it does not isolate a company-specific cause.';
        if (/\bwatchlist\b/.test(input)) return 'Friday’s watchlist was mostly lower: eight of the nine stocks with a recorded daily change declined. Apple was the exception, rising 0.43% to $343.46. Lumentum fell 5.22% and Meta fell 3.72%. Target’s daily change is unavailable, so it is excluded from that count.';
        if (/\b(?:markets?|dow|s&p|indices|indexes|rout|recap|summary|briefing|overview)\b/.test(input)) return 'U.S. stocks ended lower on Friday, October 16, 2026. The S&P 500 lost about 1.1%, the Nasdaq fell about 2.1%, and the Dow slipped about 0.3%. Technology shares led the weakness, and the Nasdaq finished its worst week since June.';
        return 'This briefing covers the October 16, 2026 session. Ask about Friday’s markets, technology stocks, gold, or the watchlist to explore the available research notes.';
    }
    function watchMarkup(stocks, selected) {
        return stocks.map(stock => `<button class="fd-gf-stock" type="button" data-gf-stock="${stock.symbol}" aria-pressed="${stock.symbol === selected}" aria-controls="fd-gf-selection"><span><strong>${stock.symbol}</strong><small>${escape(stock.name)}</small></span><span class="fd-gf-stock-dash" aria-hidden="true">—</span><span><strong>$${stock.price}</strong><small class="${stock.change?.startsWith('+') ? 'fd-gf-positive' : stock.change ? 'fd-gf-negative' : ''}">${stock.change || 'Not shown'}${stock.change ? `<i aria-hidden="true">${stock.change.startsWith('+') ? '↑' : '↓'}</i>` : ''}</small></span></button>`).join('');
    }
    function markup() {
        return `<div class="fd-gf">
            <header class="fd-gf-header"><div class="fd-gf-brand" aria-label="Google Finance"><strong>Google</strong> Finance</div><div class="fd-gf-search">${icons.sparkle}<label class="fd-gf-sr-only" for="fd-gf-search-input">Search the watchlist</label><input id="fd-gf-search-input" type="search" data-gf-search placeholder="Search for stocks, ETFs, and more" autocomplete="off" spellcheck="false"><span class="fd-gf-search-mic" aria-hidden="true">${icons.mic}</span><button type="button" class="fd-gf-icon-button" data-gf-action="clear-search" hidden aria-label="Clear watchlist search">${icons.close}</button></div><div class="fd-gf-profile-wrap"><span class="fd-gf-header-tools" aria-hidden="true">${icons.gear}${icons.feedback}</span><span class="fd-gf-app-grid" aria-hidden="true">⠿</span><button class="fd-gf-avatar" type="button" disabled aria-label="Parv Jain profile">PJ</button></div></header>
            <div class="fd-gf-notice"><span>Friday market briefing</span><time datetime="2026-10-16">Oct 16, 2026</time></div>
            <div class="fd-gf-columns">
                <aside class="fd-gf-sidebar" aria-label="Lists and portfolios" data-lenis-prevent><h2 class="fd-gf-column-title">Lists <span aria-hidden="true">⌄</span></h2><section class="fd-gf-portfolios"><div class="fd-gf-section-heading"><h3>Portfolios</h3><button type="button" class="fd-gf-icon-button" data-gf-action="create-portfolio" aria-label="Create a local portfolio">${icons.plus}</button></div><button type="button" class="fd-gf-pill fd-gf-create" data-gf-action="create-portfolio">${icons.plus}Create a portfolio</button><form class="fd-gf-portfolio-form" data-gf-portfolio-form hidden><label for="fd-gf-portfolio-name">Local portfolio name</label><input id="fd-gf-portfolio-name" data-gf-portfolio-name maxlength="40" placeholder="My portfolio" required><div><button class="fd-gf-primary" type="submit">Create</button><button type="button" data-gf-action="cancel-portfolio">Cancel</button></div></form><p class="fd-gf-portfolio-status" data-gf-portfolio-status></p><ul class="fd-gf-portfolio-list" data-gf-portfolios></ul></section><div class="fd-gf-section-heading fd-gf-watch-heading"><h3>Watchlist</h3><span aria-hidden="true">${icons.trend}</span></div><div class="fd-gf-watchlist" data-gf-watchlist>${watchMarkup(watchlist, null)}</div><p class="fd-gf-empty-watch" data-gf-empty-watch hidden>No matches in this snapshot.</p><p class="fd-gf-watch-count" data-gf-watch-count>10 symbols · Friday close</p></aside>
                <section class="fd-gf-market" aria-label="Friday market overview" data-lenis-prevent><div class="fd-gf-alerts"><button type="button" class="fd-gf-alert" disabled>${icons.broadcast}<span>NFLX Q3 2026 earnings</span><b>Oct 20</b></button><button type="button" class="fd-gf-alert" data-gf-action="alert-lite">${icons.trend}<span>Why is LITE down <em class="fd-gf-negative">5.22%</em>?</span><b>Dive Deeper</b>${icons.chevron}</button></div><div class="fd-gf-regions" role="group" aria-label="Market region">${regions.map(region => `<button type="button" data-gf-region="${region}" aria-pressed="${region === 'US'}" ${region !== 'US' ? 'disabled' : ''}>${region}</button>`).join('')}</div><div data-gf-us-view><div class="fd-gf-indices">${indices.map((index, position) => `<button class="fd-gf-index fd-gf-${index.direction}" type="button" data-gf-index="${index.id}" aria-pressed="false" aria-controls="fd-gf-selection"><strong>${escape(index.name)}</strong><span>${index.value}</span><small>(${index.amount})</small><b>${index.change} <i aria-hidden="true">${index.direction === 'up' ? '↑' : '↓'}</i></b>${sparkline(position)}</button>`).join('')}</div><p class="fd-gf-chart-caption">Chart illustrations · Friday close</p></div><div class="fd-gf-region-empty" data-gf-region-empty hidden></div><aside class="fd-gf-selection" id="fd-gf-selection" data-gf-selection hidden><button type="button" class="fd-gf-icon-button" data-gf-action="close-detail" aria-label="Close snapshot details">${icons.close}</button><strong data-gf-detail-title></strong><p data-gf-detail-copy></p></aside><section class="fd-gf-news" data-gf-news><h2>US market summary</h2><details class="fd-gf-article" data-gf-article="rout" open><summary><span>Tech Rout Deepens over AI Payoff Concerns</span><span class="fd-gf-source-badges" aria-hidden="true"><i>MW</i><i>NYT</i><i>WSJ</i></span><small>3 sites</small><span class="fd-gf-disclosure" aria-hidden="true">⌄</span></summary><div><p>Wall Street suffered a sharp downturn at the end of the week as rising anxieties over massive artificial intelligence expenditures triggered a major selloff. High-flying technology and semiconductor companies bore the brunt of the downturn, with chipmakers like Micron Technology and Intel posting substantial individual losses.</p><button class="fd-gf-pill" type="button" data-gf-action="deeper-rout">${icons.sparkle}Dive deeper</button><small class="fd-gf-reference-copy">Market overview · October 16, 2026</small></div></details><article class="fd-gf-article fd-gf-headline-only" data-gf-article="week"><h3>Major Stock Indexes Record Worst Week Since June</h3></article><article class="fd-gf-article fd-gf-headline-only" data-gf-article="fed"><h3>Federal Reserve Chair Refrains From Predicting Future Rate Actions</h3></article></section></section>
                <aside class="fd-gf-research" aria-label="Friday market research"><div class="fd-gf-section-heading"><h2 class="fd-gf-column-title">Research</h2><button class="fd-gf-icon-button" type="button" disabled aria-label="Edit research">${icons.new}</button></div><div class="fd-gf-research-scroll" data-gf-research-scroll data-lenis-prevent><h3>Hi Parv, explore Friday’s markets</h3><article class="fd-gf-response" data-gf-response hidden><strong data-gf-response-question></strong><p data-gf-response-copy></p></article><div class="fd-gf-questions">${questions.map(question => `<button type="button" data-gf-question="${escape(question)}"><span>${escape(question)}</span>${icons.sparkle}</button>`).join('')}</div><h4>Explore what’s possible</h4><div class="fd-gf-actions"><button class="fd-gf-pill" type="button" data-gf-action="create-portfolio">${icons.plus}Create a portfolio</button><button class="fd-gf-pill" type="button" disabled>${icons.task}Create a task</button><button class="fd-gf-pill" type="button" disabled>${icons.sparkle}Deep Search</button><button class="fd-gf-pill" type="button" data-gf-action="analyze-watchlist">${icons.trend}Analyze my watchlist</button></div></div><form class="fd-gf-composer" data-gf-research-form><label class="fd-gf-sr-only" for="fd-gf-prompt">Ask about Friday’s markets</label><textarea id="fd-gf-prompt" data-gf-prompt rows="2" maxlength="400" placeholder="Ask anything"></textarea><div><small>Briefing · Oct 16, 2026</small><button type="submit" class="fd-gf-send" aria-label="Submit market question">${icons.send}</button></div></form></aside>
            </div><span class="fd-gf-sr-only" role="status" aria-live="polite" aria-atomic="true" data-gf-status></span>
        </div>`;
    }

    function init(panel) {
        if (!panel || panel.dataset.googleReady === 'true') return null;
        const app = panel.querySelector('.fd-gf');
        if (!app) return null;
        panel.dataset.googleReady = 'true';
        const $ = selector => app.querySelector(selector);
        const $$ = selector => Array.from(app.querySelectorAll(selector));
        const state = { query: '', region: 'US', selectedStock: null, selectedIndex: null, portfolios: [], lastQuestion: '', lastAnswer: '' };
        const search = $('[data-gf-search]');
        const list = $('[data-gf-watchlist]');
        const prompt = $('[data-gf-prompt]');
        const announce = message => { $('[data-gf-status]').textContent = message; };
        const isMobile = () => panel.ownerDocument?.defaultView?.matchMedia('(max-width: 900px)').matches;
        const revealOnMobile = element => {
            if (isMobile()) element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        };
        function revealMarketDetail() {
            const market = $('.fd-gf-market');
            const detail = $('[data-gf-selection]');
            // Desktop stays inside its pane; stacked mobile content must be brought into view.
            if (isMobile()) { revealOnMobile(detail); return; }
            if (!(market.clientHeight > 0) || market.scrollHeight <= market.clientHeight) return;
            const top = detail.offsetTop;
            const bottom = top + detail.offsetHeight;
            if (bottom > market.scrollTop + market.clientHeight) market.scrollTop = Math.max(0, bottom - market.clientHeight + 8);
            if (top < market.scrollTop) market.scrollTop = Math.max(0, top - 8);
        }
        function showDetail(title, copy) {
            $('[data-gf-selection]').hidden = false;
            $('[data-gf-detail-title]').textContent = title;
            $('[data-gf-detail-copy]').textContent = copy;
            revealMarketDetail();
            announce(`${title}. ${copy}`);
        }
        function renderWatchlist() {
            const matches = filterWatchlist(state.query);
            list.innerHTML = watchMarkup(matches, state.selectedStock);
            $('[data-gf-empty-watch]').hidden = matches.length !== 0;
            $('[data-gf-watch-count]').textContent = `${matches.length} ${matches.length === 1 ? 'symbol' : 'symbols'} · daily change`;
            Array.from(list.querySelectorAll('[data-gf-stock]')).forEach(button => button.addEventListener('click', () => selectStock(button.dataset.gfStock)));
            return matches;
        }
        function filter(query) {
            state.query = String(query || '');
            $('[data-gf-action="clear-search"]').hidden = !state.query;
            const matches = renderWatchlist();
            announce(`${matches.length} matching symbols in the watchlist.`);
            return matches;
        }
        function selectRegion(region) {
            if (region !== 'US') return false;
            state.region = region;
            $$('[data-gf-region]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gfRegion === region)));
            $('[data-gf-us-view]').hidden = region !== 'US';
            $('[data-gf-news]').hidden = region !== 'US';
            $('[data-gf-region-empty]').hidden = region === 'US';
            $('[data-gf-region-empty]').textContent = '';
            $('[data-gf-selection]').hidden = true;
            state.selectedStock = null;
            state.selectedIndex = null;
            $$('[data-gf-stock], [data-gf-index]').forEach(button => button.setAttribute('aria-pressed', 'false'));
            announce('Showing the US market snapshot for October 16, 2026.');
            return true;
        }
        function selectStock(symbol) {
            const stock = watchlist.find(item => item.symbol === symbol);
            if (!stock) return false;
            selectRegion('US');
            state.selectedStock = symbol;
            $$('[data-gf-stock]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gfStock === symbol)));
            showDetail(`${stock.symbol} · ${stock.name}`, `$${stock.price} USD · ${stock.change ? `${stock.change} daily change` : 'Change not visible in the reference'}. Friday close: October 16, 2026.`);
            return true;
        }
        function selectIndex(id) {
            const index = indices.find(item => item.id === id);
            if (!index) return false;
            selectRegion('US');
            state.selectedIndex = id;
            $$('[data-gf-index]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gfIndex === id)));
            showDetail(index.name, `${index.value} · ${index.change} (${index.amount}) daily change on October 16, 2026. The mini-chart is a decorative reference shape, not an intraday data series.`);
            return true;
        }
        function showResponse(question, answer) {
            state.lastQuestion = question;
            state.lastAnswer = answer;
            $('[data-gf-response]').hidden = false;
            $('[data-gf-response-question]').textContent = question;
            $('[data-gf-response-copy]').textContent = answer;
            $('[data-gf-research-scroll]').scrollTop = 0;
            revealOnMobile($('[data-gf-response]'));
            announce(answer);
        }
        function submitResearch(question = prompt.value) {
            const clean = String(question || '').trim().slice(0, 400);
            if (!clean) { announce('Enter a question about Friday’s markets.'); prompt.focus({ preventScroll: true }); return false; }
            prompt.value = clean;
            showResponse(clean, researchReply(clean));
            return true;
        }
        function openPortfolio() {
            $('[data-gf-portfolio-form]').hidden = false;
            $('[data-gf-portfolio-status]').textContent = 'A local draft only. No account, holdings, or trades.';
            $('.fd-gf-sidebar').scrollTop = 0;
            $('[data-gf-portfolio-name]').focus({ preventScroll: true });
            revealOnMobile($('[data-gf-portfolio-form]'));
            announce('Name your local portfolio draft in the Lists column.');
        }
        function createPortfolio(name) {
            const clean = String(name || '').trim().slice(0, 40);
            let error = '';
            if (!clean) error = 'Enter a portfolio name.';
            else if (state.portfolios.some(item => item.toLowerCase() === clean.toLowerCase())) error = 'That local portfolio already exists.';
            else if (state.portfolios.length >= 5) error = 'You can keep up to five drafts. Reloading clears them.';
            if (error) { $('[data-gf-portfolio-status]').textContent = error; announce(error); return false; }
            state.portfolios.push(clean);
            const row = (panel.ownerDocument || document).createElement('li');
            row.textContent = clean;
            const badge = (panel.ownerDocument || document).createElement('small');
            badge.textContent = 'Local draft';
            row.append(badge);
            $('[data-gf-portfolios]').append(row);
            $('[data-gf-portfolio-name]').value = '';
            $('[data-gf-portfolio-form]').hidden = true;
            $('[data-gf-portfolio-status]').textContent = 'Saved for this page session only. No account connected.';
            $('.fd-gf-create').focus({ preventScroll: true });
            announce(`Created local portfolio draft ${clean}.`);
            return true;
        }
        const actions = {
            'clear-search'() { search.value = ''; filter(''); search.focus({ preventScroll: true }); },
            'create-portfolio': openPortfolio,
            'cancel-portfolio'() { $('[data-gf-portfolio-form]').hidden = true; $('[data-gf-portfolio-status]').textContent = ''; $('.fd-gf-create').focus({ preventScroll: true }); },
            'close-detail'() {
                const origin = state.selectedStock ? $(`[data-gf-stock="${state.selectedStock}"]`) : state.selectedIndex ? $(`[data-gf-index="${state.selectedIndex}"]`) : null;
                $('[data-gf-selection]').hidden = true;
                state.selectedStock = null;
                state.selectedIndex = null;
                $$('[data-gf-stock], [data-gf-index]').forEach(button => button.setAttribute('aria-pressed', 'false'));
                const target = origin || search;
                target.focus({ preventScroll: true });
                revealOnMobile(target);
            },
            'analyze-watchlist'() { submitResearch('Analyze my watchlist'); },
            'deeper-rout'() { submitResearch('What happened in the markets on Friday?'); },
            'alert-lite'() { submitResearch('How did LITE perform on Friday?'); }
        };
        $$('[data-gf-action]').filter(button => !button.hasAttribute('disabled')).forEach(button => button.addEventListener('click', () => actions[button.dataset.gfAction]?.()));
        $$('[data-gf-region]').filter(button => !button.hasAttribute('disabled')).forEach(button => button.addEventListener('click', () => selectRegion(button.dataset.gfRegion)));
        $$('[data-gf-index]').forEach(button => button.addEventListener('click', () => selectIndex(button.dataset.gfIndex)));
        $$('[data-gf-question]').forEach(button => button.addEventListener('click', () => submitResearch(button.dataset.gfQuestion)));
        search.addEventListener('input', () => filter(search.value));
        search.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); const first = filterWatchlist(search.value)[0]; if (first) selectStock(first.symbol); } });
        $('[data-gf-research-form]').addEventListener('submit', event => { event.preventDefault(); submitResearch(); });
        $('[data-gf-portfolio-form]').addEventListener('submit', event => { event.preventDefault(); createPortfolio($('[data-gf-portfolio-name]').value); });
        renderWatchlist();
        return { state, filter, selectStock, selectIndex, selectRegion, submitResearch, createPortfolio };
    }
    const api = Object.freeze({ markup, init, watchlist, indices, regions, questions, filterWatchlist, researchReply });
    if (typeof window !== 'undefined') window.FinanceGoogle = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
