/* Local, dependency-free monitor UI. All editorial and market views are simulated. */
(() => {
    'use strict';

    const mount = document.getElementById('finance-workspace');
    if (!mount || mount.dataset.workspaceReady === 'true') return;
    mount.dataset.workspaceReady = 'true';
    mount.classList.add('fd-workspace');
    const googleFinance = typeof window !== 'undefined' ? window.FinanceGoogle : null;

    const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg>';
    const trophy = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5h12v9a6 6 0 0 1-12 0V5ZM10 8H5v4a5 5 0 0 0 6 5M22 8h5v4a5 5 0 0 1-6 5M16 20v6M11 27h10"/><path d="m16 8 1.3 2.7 3 .4-2.1 2.1.5 3-2.7-1.5-2.7 1.5.5-3-2.1-2.1 3-.4Z"/></svg>';
    const crownedCapital = '<svg class="fd-wealth-crown" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="m5 10 5 4 6-8 6 8 5-4-3 13H8Z"/><path d="M9 26h14"/></svg>';
    const projects = [
        { id: 'consulting', title: 'Consulting Case', category: 'CASE COMPETITION', result: '1st place · 25 teams', href: '812Consulting - LaserZone.pdf', icon: trophy, style: 'gold', summary: 'Placed 1st of 25 teams with a consulting strategy to improve customer experience, streamline operations, and grow revenue.' },
        { id: 'wealth', title: 'Private Wealth', category: 'CASE COMPETITION', result: '1st place · 45+ teams', href: 'Private Wealth Management.pdf', icon: crownedCapital, style: 'wealth', summary: 'Placed 1st of 45+ teams by developing a $110M portfolio allocation strategy for a high-net-worth client case.' },
        { id: 'coinbase', title: 'Coinbase Q3’25', category: 'FINANCIAL MODEL', result: 'Opens Google Sheets', href: 'https://docs.google.com/spreadsheets/d/1JKcRT2emJ8IUWDeug5giFShgo8qky_i3H_NQa2J0Sro/edit?usp=sharing', logo: 'excel', style: 'green', summary: 'Built a Coinbase Q3’25 revenue forecast with transparent assumptions, supporting data, and a written explanation of the model.' },
        { id: 'seagate', title: 'Seagate · STX', category: 'EQUITY RESEARCH', result: 'Original case-study research', href: 'STX Fund Stock Pitch.pdf', logo: 'seagate', style: 'seagate', summary: 'My original Seagate case study explored AI and cloud storage demand, with a $120.58 price target and 18.3% upside at the time of the research.' },
        { id: 'meta', title: 'Meta · META', category: 'EQUITY RESEARCH', result: 'Original case-study research', href: 'Meta Stock Pitch.pdf', logo: 'meta', style: 'blue', summary: 'My original Meta case study examined AI integration and metaverse investments, supporting a Buy thesis and a $725 target at the time of the research.' }
    ];

    const tabs = [
        { id: 'projects', name: 'Projects', mark: '<span class="fd-tab-project-mark" aria-hidden="true">P</span>' },
        { id: 'wsj', name: 'WSJ', mark: '<span class="fd-tab-wordmark fd-wordmark-wsj" aria-hidden="true"><img src="assets/finance/wsj-logo.png" alt="" width="512" height="512" draggable="false"></span>' },
        { id: 'ft', name: 'Financial Times', mark: '<span class="fd-tab-wordmark fd-wordmark-ft" aria-hidden="true">FT</span>' },
        { id: 'yahoo', name: 'Yahoo Finance', mark: '<span class="fd-tab-wordmark fd-wordmark-yahoo" aria-hidden="true">y!</span>' },
        { id: 'bloomberg', name: 'Bloomberg', mark: '<span class="fd-tab-wordmark fd-wordmark-bloomberg" aria-hidden="true">B</span>' },
        { id: 'google', name: 'Google Finance', mark: '<span class="fd-tab-wordmark fd-wordmark-google" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M2 17a1 1 0 0 1 1-1h5v7l-6 6Z" fill="#ea4335"/><path d="M9 10a1 1 0 0 1 1-1h5v16l-6-5Z" fill="#fbbc04"/><path d="M16 3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v15l-7 7Z" fill="#34a853"/><path d="m2 30 7-7 7 6 13-13M23 16h6v6" fill="none" stroke="#1a73e8" stroke-width="3" stroke-linejoin="miter"/></svg></span>' }
    ];

    // Authentic app artwork, displayed as a decorative desktop dock without launch actions.
    const taskbarApps = [
        { name: 'Files', file: 'file-explorer.svg' },
        { name: 'Google Chrome', file: 'chrome.png' },
        { name: 'Spotify', file: 'spotify.png' },
        { name: 'Slack', file: 'slack.png' },
        { name: 'Codex', file: 'codex.png' },
        { name: 'Notion', file: 'notion.png' },
        { name: 'Microsoft Copilot', file: 'copilot.svg' },
        { name: 'Claude', file: 'claude.png' },
        { name: 'Microsoft Excel', file: 'excel.png' }
    ];

    const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const spark = (color = '#61d9ae', variation = 0) => `<svg class="fd-spark" viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden="true"><path class="fd-spark-grid" d="M0 20h240M0 40h240M0 60h240M60 0v80M120 0v80M180 0v80"/><path fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="${variation ? 'M0 61 15 55 29 60 44 44 57 49 72 41 89 46 104 29 121 36 136 24 151 30 166 19 181 28 197 15 211 21 226 11 240 15' : 'M0 64 14 58 27 63 39 48 53 53 68 45 82 51 96 36 109 41 125 28 139 34 153 23 170 30 183 16 196 24 213 12 228 18 240 7'}"/></svg>`;
    const icon = (path, className = '') => `<svg class="fd-ui-icon ${className}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const folderIcon = icon('<path d="M2 5h6l2 2h8v9H2Z"/><path d="M2 5V3h6l2 2h8v2"/>');
    const chartIcon = icon('<path d="M3 3v14h14M6 12l4-4 3 2 4-6"/>');
    const editorialIllustration = (id, accent) => `<svg class="fd-editorial-art" viewBox="0 0 260 175" role="img" aria-label="Original illustration of computing infrastructure"><defs><linearGradient id="fd-art-bg-${id}" x2="1" y2="1"><stop stop-color="${accent}" stop-opacity=".2"/><stop offset="1" stop-color="#071424"/></linearGradient><linearGradient id="fd-art-server-${id}"><stop stop-color="#8197ac"/><stop offset=".18" stop-color="#314659"/><stop offset="1" stop-color="#0a1a28"/></linearGradient><radialGradient id="fd-art-glow-${id}"><stop stop-color="${accent}" stop-opacity=".55"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="260" height="175" fill="#0c1a29"/><rect width="260" height="175" fill="url(#fd-art-bg-${id})"/><ellipse cx="133" cy="97" rx="127" ry="86" fill="url(#fd-art-glow-${id})"/><g stroke="#7c9aab" stroke-opacity=".16" stroke-width=".7"><path d="M0 143 130 78 260 143M0 160 130 95 260 160M28 175 130 113 232 175M0 111l130 64 130-64"/><path d="m32 0 96 175M87 0l42 175M172 0l-43 175M228 0 130 175"/></g>${[0,1,2,3].map((column) => { const x = 40 + column * 47; const y = 53 - column * 4; return `<g><path d="m${x} ${y} 19-10 28 10v86l-19 12-28-12Z" fill="#101e2e"/><path d="m${x} ${y} 28 10v88l-28-12Z" fill="url(#fd-art-server-${id})"/><path d="m${x+28} ${y+10} 19-10v86l-19 12Z" fill="#08131e"/>${[0,1,2,3,4].map(row => `<path d="m${x+4} ${y+14+row*14} 20 7v7l-20-7Z" fill="#142b3d" stroke="#7f9bac" stroke-opacity=".3" stroke-width=".5"/><path d="m${x+7} ${y+18+row*14} 2 .7" stroke="${accent}" stroke-width="1.6"/>`).join('')}</g>`; }).join('')}<text x="14" y="21" fill="#c3d1df" font-size="7" letter-spacing="2" font-family="sans-serif">THE COMPUTE ECONOMY</text><text x="14" y="161" fill="#92a8ba" font-size="6" letter-spacing="1.1" font-family="sans-serif">ORIGINAL EDITORIAL ILLUSTRATION</text></svg>`;

    const projectCards = projects.map(project => `
        <article class="fd-project fd-project-${project.id}" data-project="${project.id}">
            <div class="fd-project-controls">
                <a class="fd-project-link" href="${escape(project.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(project.title)}: ${escape(project.result)}. Open ${project.id === 'coinbase' ? 'Google Sheets' : 'PDF'} in a new tab." aria-describedby="fd-preview-${project.id}">
                    <span class="fd-project-logo fd-project-logo-${project.style}">${project.logoSrc || project.logo ? `<img src="${project.logoSrc || `assets/finance/${project.logo}.svg`}" alt="" width="28" height="28" draggable="false">` : project.icon}</span>
                    <span class="fd-project-copy"><span class="fd-project-category">${project.category}</span><strong>${project.title}</strong><span class="fd-project-result">${project.result}</span></span>
                    <span class="fd-project-arrow">${arrow}</span>
                </a>
                <button class="fd-project-info" type="button" aria-label="Preview ${escape(project.title)}" aria-expanded="false" aria-controls="fd-preview-${project.id}" data-preview="${project.id}">i</button>
            </div>
            <div class="fd-project-summary" id="fd-preview-${project.id}" hidden><span class="fd-summary-dot fd-summary-dot-${project.style}"></span><p>${project.summary}</p></div>
        </article>`).join('');

    const publicationNav = labels => `<div class="fd-publication-nav" aria-hidden="true">${labels.map(label => `<span>${label}</span>`).join('')}</div>`;
    const simulationNote = publisher => `<p class="fd-simulation-note">Original simulated content and market data. Not live news or reporting from ${publisher}.</p>`;
    const ftCapitalArt = `<svg class="fd-ft-capital-art" viewBox="0 0 200 170" role="img" aria-label="Original illustration of capital flowing into computing"><rect width="200" height="170" fill="#ead8c0"/><path d="M0 133 104 77l96 48v45H0Z" fill="#d7c4ab"/><g stroke="#beaa8f" stroke-width=".6"><path d="m0 148 106-56 94 47M22 170l87-48 73 40M44 108l116 62M92 80l108 54"/></g>${[[26,96,27,46],[62,71,30,70],[101,40,32,96],[143,20,32,108]].map(([x,y,w,h],index) => `<g><path d="m${x} ${y} ${w} 13 12-7-${w}-13Z" fill="${['#688b89','#4d817e','#39716f','#22625e'][index]}"/><path d="m${x} ${y} ${w} 13v${h}l-${w}-13Z" fill="${['#8baba5','#689992','#4c857d','#2e746a'][index]}"/><path d="m${x+w} ${y+13} 12-7v${h}l-12 7Z" fill="#305c56"/></g>`).join('')}<path d="M19 85 54 58 94 26 139 12" fill="none" stroke="#e29a65" stroke-width="3"/><path d="m132 8 9 3-3 9" fill="none" stroke="#e29a65" stroke-width="3"/><text x="10" y="158" fill="#4f665f" font-family="sans-serif" font-size="6" letter-spacing="1.1">ILLUSTRATION / NOT MEASURED DATA</text></svg>`;
    const bloombergArt = `<svg class="fd-bloomberg-art" viewBox="0 0 250 175" role="img" aria-label="Original abstract illustration of an AI chip and capital flows"><defs><linearGradient id="fd-bb-art-bg" x2="1" y2="1"><stop stop-color="#ff5c9e"/><stop offset="1" stop-color="#6157dc"/></linearGradient><linearGradient id="fd-bb-chip" x2="1" y2="1"><stop stop-color="#f6e4e8"/><stop offset=".5" stop-color="#a1b2d4"/><stop offset="1" stop-color="#526e9b"/></linearGradient></defs><rect width="250" height="175" fill="url(#fd-bb-art-bg)"/><g stroke="#ffcfdf" stroke-opacity=".45" fill="none"><path d="M0 39h58l29 29M0 126h50l33-22M250 36h-46l-34 31M250 144h-67l-30-31M46 0v31l30 26M185 0v33l-23 24M43 175v-30l29-28M210 175v-32l-32-25" stroke-width="2"/><circle cx="58" cy="39" r="4"/><circle cx="204" cy="36" r="4"/><circle cx="50" cy="126" r="4"/></g><path d="m68 64 61-35 61 35v61l-61 34-61-34Z" fill="#2c3974"/><path d="m68 64 61 34 61-34v19l-61 35-61-35Z" fill="#102549"/><path d="m68 64 61-35 61 35-61 34Z" fill="url(#fd-bb-chip)"/><path d="m85 63 44-25 44 25-44 25Z" fill="#26334e" stroke="#d6e1f1" stroke-width="1"/><text x="114" y="69" fill="#f4d8ed" font-family="sans-serif" font-weight="700" font-size="18">AI</text><text x="13" y="160" fill="#fff0f5" font-family="sans-serif" font-size="7" letter-spacing="1.5">THE NEW CAPITAL STACK</text></svg>`;
    const newsViews = `
        <section class="fd-tab-panel fd-publication fd-wsj-page" id="fd-panel-wsj" role="tabpanel" aria-labelledby="fd-tab-wsj" tabindex="0" data-lenis-prevent hidden>
            <div class="fd-wsj-utility" aria-hidden="true"><span>WSJ</span><span>Business</span><span>Markets</span><span>The Journal</span><span>U.S. Edition</span></div>
            <div class="fd-wsj-masthead"><img class="fd-wsj-masthead-logo" src="assets/finance/wsj-logo.png" alt="WSJ: The Wall Street Journal" width="512" height="512" draggable="false"><span>THE ANALYST’S DESK <i>·</i> SIMULATED EDITION</span></div>
            ${publicationNav(['World','Business','U.S.','Politics','Economy','Tech','Markets','Opinion','Lifestyle'])}
            <div class="fd-wsj-layout"><article class="fd-wsj-lead"><span class="fd-news-kicker">BUSINESS OF TECHNOLOGY</span><h3>The infrastructure beneath the AI boom</h3><p>A simulated briefing on the chips, power, and data centers behind the next wave of computing.</p><span class="fd-news-byline">Original desk briefing <i>·</i> 3 min read</span></article><figure class="fd-wsj-feature">${editorialIllustration('wsj', '#7399be')}<figcaption>Original illustration of computing infrastructure</figcaption><h4>Compute is only the beginning</h4><p>Understanding the businesses behind the build-out, from storage to the grid.</p></figure><aside class="fd-wsj-opinion"><strong>OPINION</strong><article><h4>Look beyond the headline number</h4><p>The assumptions inside a forecast can matter as much as its conclusion.</p></article><article><h4>The patient capital question</h4><p>A long view of innovation, margins, and returns.</p></article></aside></div>
            ${simulationNote('The Wall Street Journal')}
        </section>
        <section class="fd-tab-panel fd-publication fd-ft-page" id="fd-panel-ft" role="tabpanel" aria-labelledby="fd-tab-ft" tabindex="0" data-lenis-prevent hidden>
            <div class="fd-ft-utility"><span>FT EDIT <i>·</i> MARKETS DATA <i>·</i> THE BIG READ</span><span>SIMULATED EDITION</span></div><div class="fd-ft-masthead"><span aria-hidden="true">${icon('<path d="M3 5h14M3 10h14M3 15h14"/>')}</span><strong>FINANCIAL TIMES</strong><span>THE ANALYST’S DESK</span></div>
            ${publicationNav(['Home','World','US','Companies','Tech','Markets','Climate','Opinion','Lex'])}
            <div class="fd-ft-layout"><div class="fd-ft-main"><span class="fd-news-kicker">THE BIG READ <i>·</i> TECHNOLOGY</span><div class="fd-ft-feature"><article><h3>Capital meets the computing frontier</h3><p>An illustrative look at the investment questions shaping digital infrastructure.</p><span class="fd-news-byline">An original desk briefing</span></article><figure>${ftCapitalArt}</figure></div><div class="fd-ft-briefs"><article><span>COMPANIES</span><h4>A new map of capital spending</h4></article><article><span>MARKETS INSIGHT</span><h4>The question behind the multiple</h4></article></div></div><aside class="fd-ft-opinion"><strong>Opinion</strong><p class="fd-ft-quote">“The next chapter of technology is also a story about capital.”</p><span>ORIGINAL DEMO COMMENTARY</span><div><b>The briefing</b><p>Scale, margins, and the economics of computing.</p><p>Reading a forecast through its assumptions.</p></div></aside></div>
            ${simulationNote('Financial Times')}
        </section>
        <section class="fd-tab-panel fd-publication fd-yahoo-page" id="fd-panel-yahoo" role="tabpanel" aria-labelledby="fd-tab-yahoo" tabindex="0" data-lenis-prevent hidden>
            <div class="fd-yahoo-masthead"><strong>yahoo!<span>finance</span></strong><span class="fd-yahoo-edition">Your market overview <small>SIMULATED SESSION</small></span><span class="fd-yahoo-avatar" aria-hidden="true">PJ</span></div>
            ${publicationNav(['My Portfolio','News','Markets','Research','Personal Finance','Videos'])}
            <div class="fd-yahoo-indices">${[['Tech composite','18,241.62','+1.82%'],['Broad market','5,682.14','+0.64%'],['Growth index','2,104.85','−0.27%']].map((entry,index)=>`<div><span>${entry[0]}</span><strong>${entry[1]}</strong><em class="${index===2?'is-negative':''}">${entry[2]}</em>${spark(index===2?'#d65b7b':'#389a77',index%2)}</div>`).join('')}</div>
            <div class="fd-yahoo-layout"><article class="fd-yahoo-story"><span class="fd-news-kicker">THE RESEARCH NOTE</span><h3>Big ideas. A closer look at the numbers.</h3><p>A generated briefing on revenue drivers, scenarios, and the assumptions behind a forecast.</p><div class="fd-yahoo-tags"><span>AI & technology</span><span>Financial models</span></div><span class="fd-news-byline">Original desk content · 4 min read</span></article><div class="fd-yahoo-watchlist"><div><strong>AI & tech watchlist</strong><span>GENERATED DATA</span></div><table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Trend</th></tr></thead><tbody>${[['NVDA','187.42','+2.14%'],['MSFT','428.16','+0.92%'],['GOOGL','203.87','+1.23%'],['AAPL','241.65','−0.38%']].map((entry,index)=>`<tr><th>${entry[0]}</th><td>${entry[1]}</td><td class="${index===3?'is-negative':''}">${entry[2]}</td><td>${spark(index===3?'#d65b7b':'#389a77',index%2)}</td></tr>`).join('')}</tbody></table></div></div>
            ${simulationNote('Yahoo Finance')}
        </section>
        <section class="fd-tab-panel fd-publication fd-bloomberg-page" id="fd-panel-bloomberg" role="tabpanel" aria-labelledby="fd-tab-bloomberg" tabindex="0" data-lenis-prevent hidden>
            <div class="fd-bb-utility"><span>Bloomberg the Company & Its Products</span><span>ORIGINAL SIMULATION / NO LIVE FEED</span></div><div class="fd-bb-masthead"><strong>Bloomberg</strong><span>THE ANALYST’S DESK</span></div>
            ${publicationNav(['Markets','Economics','Technology','Politics','Wealth','Businessweek','Opinion'])}
            <div class="fd-bb-section"><b>THE AI ECONOMY</b><span>Ideas. Infrastructure. Investment.</span></div>
            <div class="fd-bb-layout"><article class="fd-bb-lead"><span class="fd-news-kicker">ORIGINAL DEMO BRIEFING</span><h3>Where AI<br>meets capital</h3><p>Exploring the infrastructure and platforms behind a hypothetical technology portfolio.</p><span class="fd-news-byline">Analysis / The long view</span></article><figure class="fd-bb-feature">${bloombergArt}<figcaption>Original illustration / The new capital stack</figcaption></figure><div class="fd-bb-market-card"><span>SIMULATED MARKET DATA</span><h4>Technology index</h4><div><strong>128.64</strong><em>+1.82%</em></div>${spark('#f4aa62',1)}<div class="fd-bb-chart-time"><span>09:30</span><span>16:00</span></div><p>Generated intraday pattern</p></div></div>
            ${simulationNote('Bloomberg')}
        </section>`;

    mount.innerHTML = `
        <div class="fd-browser-top"><span class="fd-browser-profile" aria-hidden="true">PJ</span><div class="fd-browser-tabs" role="tablist" aria-label="Monitor views">${tabs.map((tab, index) => `<button id="fd-tab-${tab.id}" class="fd-browser-tab" type="button" role="tab" aria-controls="fd-panel-${tab.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-tab="${tab.id}">${tab.mark}<span>${tab.name}</span><i aria-hidden="true">×</i></button>`).join('')}</div><span class="fd-window-controls" aria-hidden="true">${icon('<path d="M4 10h12"/>')}${icon('<rect x="5" y="5" width="10" height="10"/>')}${icon('<path d="m5 5 10 10M5 15 15 5"/>')}</span></div>
        <div class="fd-browser-address"><span class="fd-browser-history" aria-hidden="true">${icon('<path d="m9 4-6 6 6 6M3 10h14"/>')}${icon('<path d="m11 4 6 6-6 6M17 10H3"/>')}${icon('<path d="M16 8a6 6 0 1 0 .2 4M16 3v5h-5"/>')}</span><span class="fd-address-value"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="7" width="8" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg><span data-address>parv.local / finance / projects</span><span class="fd-address-star" aria-hidden="true">☆</span></span><span class="fd-browser-tools" aria-hidden="true">${icon('<path d="M5 2h5v4a2 2 0 1 1 4 0h4v5h-4a2 2 0 1 1 0 4v3H5v-5H2V8h3Z"/>')}${icon('<path d="M4 3h12v14H4ZM11 3v14"/>')}<i>···</i></span></div>
        <div class="fd-bookmark-bar" aria-hidden="true"><span>${folderIcon} Finance</span><i></i><span>${chartIcon} Research library</span><span><b class="fd-bookmark-green"></b> Financial models</span><span><b class="fd-bookmark-gold"></b> Case competitions</span><span class="fd-bookmark-local">LOCAL WORKSPACE</span></div>
        <div class="fd-browser-content">
            <section class="fd-tab-panel fd-project-panel" id="fd-panel-projects" role="tabpanel" aria-labelledby="fd-tab-projects" tabindex="0">
                <div class="fd-project-heading"><div><span class="fd-workspace-eyebrow">THE RESEARCH COLLECTION</span><h2>Parv’s Finance Projects</h2></div><span class="fd-project-count">05 <span>PROJECTS</span></span></div>
                <div class="fd-library-toolbar"><span>${folderIcon} <span>Parv</span><i>›</i><b>Finance</b><i>›</i><span>Project library</span></span><span class="fd-library-meta">2 case wins <i>·</i> 1 model <i>·</i> 2 stock pitches</span></div>
                <div class="fd-project-grid">${projectCards}</div>
                <div class="fd-project-preview-placeholder"><span class="fd-preview-pointer" aria-hidden="true">↗</span><p>Hover or focus a project to explore.<br><span>Click to open the original work in a new tab.</span></p></div>
            </section>
            ${newsViews}
            <section class="fd-tab-panel fd-google-panel" id="fd-panel-google" role="tabpanel" aria-labelledby="fd-tab-google" tabindex="0" data-lenis-prevent hidden>${googleFinance ? googleFinance.markup() : '<p class="fd-loading">Google Finance local preview could not load. Please refresh this page.</p>'}</section>
        </div>
        <div class="fd-windows-taskbar" role="group" aria-label="Decorative Windows taskbar"><span class="fd-taskbar-weather" aria-hidden="true">${icon('<circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"/>')}<span>72°F<br><b>Sunny</b></span></span><div class="fd-taskbar-apps"><span class="fd-windows-logo" title="Start" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="fd-taskbar-search" aria-hidden="true">${icon('<circle cx="8" cy="8" r="5"/><path d="m12 12 5 5"/>')}<span>Search</span></span>${taskbarApps.map(app => `<span class="fd-taskbar-app" title="${app.name}" data-tooltip="${app.name}"><img src="assets/finance/apps/${app.file}" alt="${app.name}" width="25" height="25" draggable="false" decoding="async"></span>`).join('')}</div><span class="fd-taskbar-status" aria-hidden="true">${icon('<path d="m3 7 3 3-3 3"/>')}${icon('<path d="M2 6a12 12 0 0 1 16 0M5 9a8 8 0 0 1 10 0M8 12a3 3 0 0 1 4 0"/><circle cx="10" cy="15" r=".7"/>')}${icon('<path d="M2 8h3l4-4v12l-4-4H2ZM12 6a6 6 0 0 1 0 8M14 3a10 10 0 0 1 0 14"/>')}<span>9:41 AM<br><small>Focus time</small></span></span></div>`;

    const tabButtons = Array.from(mount.querySelectorAll('[role="tab"]'));
    const panels = Array.from(mount.querySelectorAll('[role="tabpanel"]'));
    const cards = Array.from(mount.querySelectorAll('[data-project]'));
    const placeholder = mount.querySelector('.fd-project-preview-placeholder');
    let activePreview = null;
    let pinnedPreview = null;

    function showPreview(id) {
        activePreview = id;
        cards.forEach(card => {
            const active = card.dataset.project === id;
            card.classList.toggle('is-previewed', active);
            card.querySelector('.fd-project-summary').hidden = !active;
            card.querySelector('.fd-project-info').setAttribute('aria-expanded', String(active));
        });
        placeholder.style.visibility = id ? 'hidden' : '';
    }

    function activateTab(id) {
        pinnedPreview = null;
        showPreview(null);
        tabButtons.forEach(button => {
            const selected = button.dataset.tab === id;
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        panels.forEach(panel => { panel.hidden = panel.id !== `fd-panel-${id}`; });
        mount.querySelector('[data-address]').textContent = id === 'projects' ? 'parv.local / finance / projects' : id === 'google' ? 'desk.demo / google-finance / local-preview' : `desk.demo / ${id} / simulated`;
        mount.dataset.activeView = id;
    }

    tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => activateTab(button.dataset.tab));
        button.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabButtons.length;
            else if (event.key === 'ArrowLeft') next = (index + tabButtons.length - 1) % tabButtons.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = tabButtons.length - 1;
            else return;
            event.preventDefault();
            activateTab(tabButtons[next].dataset.tab);
            tabButtons[next].focus({ preventScroll: true });
        });
    });

    cards.forEach(card => {
        const id = card.dataset.project;
        card.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') showPreview(id); });
        card.addEventListener('pointerleave', event => {
            if (event.pointerType === 'touch' || card.contains(document.activeElement)) return;
            showPreview(pinnedPreview);
        });
        card.addEventListener('focusin', () => showPreview(id));
        card.addEventListener('focusout', event => { if (!card.contains(event.relatedTarget)) showPreview(pinnedPreview); });
        card.querySelector('.fd-project-info').addEventListener('click', () => {
            pinnedPreview = pinnedPreview === id ? null : id;
            showPreview(pinnedPreview);
        });
    });

    mount.addEventListener('keydown', event => {
        if (event.key === 'Escape' && activePreview) {
            event.preventDefault();
            pinnedPreview = null;
            showPreview(null);
        }
    });
    document.addEventListener('pointerdown', event => {
        if (activePreview && !event.target.closest('.fd-project')) {
            pinnedPreview = null;
            showPreview(null);
        }
    });
    mount.dataset.activeView = 'projects';
    // Initialize the extra preview after the shared monitor navigation is ready.
    if (googleFinance) googleFinance.init(mount.querySelector('#fd-panel-google'));
})();
