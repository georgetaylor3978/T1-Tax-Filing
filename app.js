/* T1 Tax Data — Dashboard Logic */
'use strict';

var DATA = null;
var selectedBracket = null;
var bracketBarChart = null;
var filersBarChart = null;
var benefitsChart = null;
var recipientsChart = null;

var BENEFIT_LINES = [
    { num: 7,  label: 'Old Age Security (OAS)',       color: '#06b6d4' },
    { num: 8,  label: 'CPP/QPP Benefits',             color: '#3b82f6' },
    { num: 9,  label: 'Other Pensions & Superannuation', color: '#8b5cf6' },
    { num: 10, label: 'Elected Split-Pension',        color: '#f59e0b' },
    { num: 11, label: 'Employment Insurance (EI)',    color: '#f43f5e' },
    { num: 17, label: 'RRSP Income',                  color: '#10b981' }
];

var BRACKET_COLORS = [
    '#6366f1','#818cf8','#a78bfa','#c084fc','#8b5cf6','#7c3aed','#6d28d9',
    '#5b21b6','#4c1d95','#3b82f6','#2563eb','#1d4ed8','#1e40af','#06b6d4',
    '#0891b2','#0e7490','#10b981','#f59e0b','#f43f5e'
];

// ── Dark/Light mode toggle ──────────────────────────────────
(function() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var saved = localStorage.getItem('t1-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function() {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('t1-theme', next);
        // Redraw charts with new colors
        if (DATA) { updateTab1(); updateTab2(); }
        if (typeof gxUpdateChart === 'function') gxUpdateChart();
    });
})();

function getChartTheme() {
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
        gridColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)',
        tickColor: dark ? '#5a6580' : '#8891ae',
        tickColorY: dark ? '#8b95b0' : '#4b5475',
        tooltipBg: dark ? 'rgba(15,21,32,0.95)' : 'rgba(255,255,255,0.97)',
        tooltipTitle: dark ? '#f0f4fc' : '#1a1f35',
        tooltipBody: dark ? '#8b95b0' : '#4b5475',
        tooltipBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        legendColor: dark ? '#8b95b0' : '#4b5475'
    };
}

// ── Init ──────────────────────────────────────────────────
async function init() {
    try {
        var resp = await fetch('data.json');
        DATA = await resp.json();
        populateBracketSelectors();
        selectedBracket = DATA.bracketLabels[0];
        document.getElementById('bracketSelect').value = selectedBracket;
        updateTab1();
        updateTab2();
        document.getElementById('dataStatus').innerHTML = '&#x25CF; Data Loaded';
        // Signal govexp-app that DATA is ready
        document.dispatchEvent(new CustomEvent('t1-data-ready'));
    } catch(e) {
        console.error('Failed to load data:', e);
        document.getElementById('dataStatus').textContent = '✕ Load Failed';
        document.getElementById('dataStatus').classList.remove('loaded');
    }
}

// ── Linked Bracket Selectors ──────────────────────────────
function populateBracketSelectors() {
    var selectors = ['bracketSelect', 'gx-bracketSelect'];
    selectors.forEach(function(id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        DATA.bracketLabels.forEach(function(b) { sel.add(new Option(b, b)); });
    });

    // Sync both selectors together
    var s1 = document.getElementById('bracketSelect');
    var s2 = document.getElementById('gx-bracketSelect');

    function onS1Change() {
        selectedBracket = s1.value;
        if (s2 && s2.value !== s1.value) s2.value = s1.value;
        updateTab1();
        // also update govexp if initialized
        if (typeof gx !== 'undefined') {
            gx.selectedBracket = s1.value;
            gxComputeShareOfPool();
            gxUpdateChart();
            gxUpdateCards();
        }
    }
    function onS2Change() {
        selectedBracket = s2.value;
        if (s1 && s1.value !== s2.value) s1.value = s2.value;
        updateTab1();
        if (typeof gx !== 'undefined') {
            gx.selectedBracket = s2.value;
            gxComputeShareOfPool();
            gxUpdateChart();
            gxUpdateCards();
        }
    }
    if (s1) s1.addEventListener('change', onS1Change);
    if (s2) s2.addEventListener('change', onS2Change);
}

// ── TAB 1: YOUR TAX BRACKET ──────────────────────────────
function updateTab1() {
    var line106 = DATA.lineItems[106];
    var line3   = DATA.lineItems[3];
    var brackets    = DATA.bracketLabels;
    var totalTax    = line106.brackets.Total.amount * 1000;
    var totalFilers = line3.brackets.Total.count;
    var population  = DATA.population;

    var perCapitaByBracket = brackets.map(function(b) {
        var tax   = line106.brackets[b].amount * 1000;
        var count = line106.brackets[b].count;
        return count > 0 ? tax / count : 0;
    });

    // Median
    var line1 = DATA.lineItems[1];
    var taxableFilers = line1.brackets.Total.count;
    var cumulative = 0, medianPerCapita = 0, medianBracketLabel = '';
    for (var mi = 0; mi < brackets.length; mi++) {
        cumulative += line1.brackets[brackets[mi]].count;
        if (cumulative >= taxableFilers / 2) {
            medianPerCapita = perCapitaByBracket[mi];
            medianBracketLabel = brackets[mi];
            break;
        }
    }

    var myTax      = line106.brackets[selectedBracket].amount * 1000;
    var myFilers   = line106.brackets[selectedBracket].count;
    var myPerCapita = myFilers > 0 ? myTax / myFilers : 0;
    var avgCanadian = totalTax / population;
    var avgFiler    = totalTax / totalFilers;
    var vsMedian    = medianPerCapita > 0 ? myPerCapita / medianPerCapita : 0;

    // KPI rows
    document.getElementById('kpi-your-tax').textContent     = formatDollars(myPerCapita);
    document.getElementById('kpi-your-tax-sub').textContent = formatNum(myFilers) + ' filers in this bracket';
    document.getElementById('kpi-avg-canadian').textContent     = formatDollars(avgCanadian);
    document.getElementById('kpi-avg-canadian-sub').textContent = 'Pop: ' + formatNum(population);
    document.getElementById('kpi-avg-filer').textContent     = formatDollars(avgFiler);
    document.getElementById('kpi-avg-filer-sub').textContent = formatNum(totalFilers) + ' total filers';
    document.getElementById('kpi-median-filer').textContent     = formatDollars(medianPerCapita);
    document.getElementById('kpi-median-filer-sub').textContent = 'Bracket: ' + medianBracketLabel;

    var vsMedianEl = document.getElementById('kpi-share');
    vsMedianEl.textContent = vsMedian.toFixed(1) + '×';
    document.getElementById('kpi-share-sub').textContent =
        formatDollars(myPerCapita) + ' vs ' + formatDollars(medianPerCapita) + ' median';

    // Top Earner Stat — now in chart 2 header
    var top2 = brackets.slice(-2);
    var top2Filers = 0, top2Tax = 0;
    top2.forEach(function(b) {
        top2Filers += line106.brackets[b].count;
        top2Tax    += line106.brackets[b].amount * 1000;
    });
    var pctPop = (top2Filers / population) * 100;
    var pctTax = (top2Tax / totalTax) * 100;
    var tEl = document.getElementById('top-earner-stat');
    if (tEl) tEl.textContent = 'Top ' + pctPop.toFixed(1) + '% pay ' + pctTax.toFixed(1) + '% of all personal tax';

    updateBracketBarChart(line106, brackets, perCapitaByBracket);
    updateFilersBarChart(line106, brackets, perCapitaByBracket);
    updateBracketTable(line106, line3, brackets, totalTax, population);
}

function updateBracketBarChart(line106, brackets, perCapitaByBracket) {
    if (bracketBarChart) { bracketBarChart.destroy(); bracketBarChart = null; }
    var th = getChartTheme();
    var bgColors     = brackets.map(function(b,i){ return b===selectedBracket ? '#ffffff' : BRACKET_COLORS[i%BRACKET_COLORS.length]; });
    var borderColors = brackets.map(function(b){ return b===selectedBracket ? '#06b6d4' : 'transparent'; });
    var borderWidths = brackets.map(function(b){ return b===selectedBracket ? 3 : 0; });

    var ctx = document.getElementById('bracket-bar-chart').getContext('2d');
    bracketBarChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: brackets, datasets: [{ label: 'Per-Capita Tax Payable', data: perCapitaByBracket, backgroundColor: bgColors, borderColor: borderColors, borderWidth: borderWidths, borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: th.tooltipBg, titleColor: th.tooltipTitle, bodyColor: th.tooltipBody, borderColor: th.tooltipBorder, borderWidth: 1, cornerRadius: 8, padding: 12,
                    callbacks: { label: function(c){ return 'Per person: ' + formatDollars(c.parsed.x); } } }
            },
            scales: {
                x: { grid: { color: th.gridColor }, ticks: { color: th.tickColor, font: { family:'Inter', size:10 }, callback: function(v){ return formatAxisDollars(v); } } },
                y: { grid: { display: false }, ticks: { color: th.tickColorY, font: { family:'Inter', size:10, weight:'500' } } }
            }
        }
    });
}

function updateFilersBarChart(line106, brackets, perCapitaByBracket) {
    if (filersBarChart) { filersBarChart.destroy(); filersBarChart = null; }
    var th = getChartTheme();
    var filerData    = brackets.map(function(b){ return line106.brackets[b].count; });
    var bgColors     = brackets.map(function(b,i){ return b===selectedBracket ? '#ffffff' : BRACKET_COLORS[i%BRACKET_COLORS.length]; });
    var borderColors = brackets.map(function(b){ return b===selectedBracket ? '#06b6d4' : 'rgba(0,0,0,0)'; });
    var borderWidths = brackets.map(function(b){ return b===selectedBracket ? 3 : 0; });

    var ctx = document.getElementById('filers-bar-chart').getContext('2d');
    filersBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: brackets,
            datasets: [
                { label: 'Tax Filers', data: filerData, backgroundColor: bgColors, borderColor: borderColors, borderWidth: borderWidths, borderRadius: 4, yAxisID: 'yLeft', order: 2 },
                { label: 'Avg Tax Per Filer (log)', data: perCapitaByBracket, type: 'line', borderColor: '#f43f5e', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#f43f5e', pointBorderColor: document.documentElement.getAttribute('data-theme')==='light' ? '#f3f4f8' : '#0a0e17', pointBorderWidth: 1.5, tension: 0.3, yAxisID: 'yRight', order: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode:'index', intersect:false },
            plugins: {
                legend: { display: true, position: 'top', align: 'start',
                    labels: { color: th.legendColor, font:{ family:'Inter', size:10 }, padding:10, boxWidth:10, usePointStyle:true } },
                tooltip: { backgroundColor: th.tooltipBg, titleColor: th.tooltipTitle, bodyColor: th.tooltipBody, borderColor: th.tooltipBorder, borderWidth:1, cornerRadius:8, padding:12,
                    callbacks: { label: function(c){ if(c.dataset.label==='Tax Filers') return formatNum(c.parsed.y)+' filers'; return 'Avg tax: '+formatDollars(c.parsed.y); } } }
            },
            scales: {
                x: { grid:{ display:false }, ticks:{ color:th.tickColor, font:{family:'Inter',size:9}, maxRotation:45, minRotation:45 }, title:{display:true, text:'Income Bracket', color:th.tickColorY, font:{size:10}} },
                yLeft: { type:'linear', position:'left', title:{display:true, text:'Number of Tax Filers', color:th.tickColorY, font:{size:10}}, grid:{ color:th.gridColor }, ticks:{ color:th.tickColor, font:{family:'Inter',size:10}, callback:function(v){ return formatNumShort(v); } } },
                yRight: { type:'logarithmic', position:'right', title:{display:true, text:'Avg Tax Per Filer (log)', color:'#f43f5e', font:{size:10}}, grid:{ drawOnChartArea:false }, ticks:{ color:'#f43f5e', font:{family:'Inter',size:10}, callback:function(v){ return formatAxisDollars(v); } } }
            }
        }
    });
}

function updateBracketTable(line106, line3, brackets, totalTax, population) {
    var container = document.getElementById('bracket-table');
    var html = '<table class="data-table"><thead><tr>';
    html += '<th>Bracket</th><th>Filers</th><th>Tax Payable ($)</th><th>Per Capita</th><th>Share of Pool</th>';
    html += '</tr></thead><tbody>';
    brackets.forEach(function(b) {
        var count   = line106.brackets[b].count;
        var amount  = line106.brackets[b].amount * 1000;
        var perCap  = count > 0 ? amount / count : 0;
        var share   = totalTax > 0 ? (amount/totalTax)*100 : 0;
        html += '<tr' + (b===selectedBracket ? ' class="highlight"' : '') + '>';
        html += '<td>'+b+'</td><td>'+formatNum(count)+'</td><td>'+formatDollarsShort(amount)+'</td>';
        html += '<td>'+formatDollars(perCap)+'</td><td>'+share.toFixed(1)+'%</td></tr>';
    });
    var tc = line106.brackets.Total.count, ta = line106.brackets.Total.amount*1000;
    html += '<tr class="total-row"><td><strong>All Filers</strong></td><td><strong>'+formatNum(tc)+'</strong></td>';
    html += '<td><strong>'+formatDollarsShort(ta)+'</strong></td><td><strong>'+formatDollars(tc>0?ta/tc:0)+'</strong></td>';
    html += '<td><strong>100%</strong></td></tr></tbody></table>';
    container.innerHTML = html;
}

// ── TAB 2: PENSIONS & BENEFITS ──────────────────────────
function updateTab2() {
    var line106 = DATA.lineItems[106];
    var line59  = DATA.lineItems[59];
    var totalTaxableIncome = line59.brackets.Total.amount * 1000;
    var totalPool = 0, totalRecipients = 0, benefitData = [];

    BENEFIT_LINES.forEach(function(bl) {
        var item = DATA.lineItems[bl.num]; if (!item) return;
        var amount = item.brackets.Total.amount * 1000;
        var count  = item.brackets.Total.count;
        totalPool += amount;
        if (count > totalRecipients) totalRecipients = count;
        benefitData.push({ label:bl.label, color:bl.color, amount:amount, count:count,
            perRecipient: count>0 ? amount/count : 0 });
    });

    document.getElementById('ben-pool').textContent = formatDollarsShort(totalPool);
    var poolPct = totalTaxableIncome > 0 ? (totalPool/totalTaxableIncome)*100 : 0;
    document.getElementById('ben-pct').textContent = poolPct.toFixed(1)+'%';
    document.getElementById('ben-pct-sub').textContent = formatDollarsShort(totalPool)+' of '+formatDollarsShort(totalTaxableIncome)+' taxable income';
    document.getElementById('ben-recipients').textContent = formatNum(totalRecipients);
    document.getElementById('ben-avg').textContent = formatDollars(totalRecipients>0 ? totalPool/totalRecipients : 0);

    var line3 = DATA.lineItems[3];
    var totalFilers = line3 ? line3.brackets.Total.count : 0;
    var sortedByAmount = benefitData.slice().sort(function(a,b){ return b.amount-a.amount; });
    var sortedByCount  = benefitData.slice().sort(function(a,b){ return b.count-a.count; });
    updateBenefitsChart(sortedByAmount);
    updateRecipientsChart(sortedByCount);
    updateBenefitsTable(benefitData, totalPool, totalFilers);
}

function updateBenefitsChart(benefitData) {
    if (benefitsChart) { benefitsChart.destroy(); benefitsChart = null; }
    var th = getChartTheme();
    var ctx = document.getElementById('benefits-chart').getContext('2d');
    benefitsChart = new Chart(ctx, {
        type:'bar',
        data:{ labels:benefitData.map(function(d){return d.label;}), datasets:[{ label:'Total Amount', data:benefitData.map(function(d){return d.amount;}), backgroundColor:benefitData.map(function(d){return hexToRgba(d.color,0.75);}), borderColor:benefitData.map(function(d){return d.color;}), borderWidth:1, borderRadius:6 }] },
        options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
            plugins:{ legend:{display:false}, tooltip:{backgroundColor:th.tooltipBg, titleColor:th.tooltipTitle, bodyColor:th.tooltipBody, callbacks:{label:function(c){return formatDollarsShort(c.parsed.x);}}} },
            scales:{ x:{grid:{color:th.gridColor}, ticks:{color:th.tickColor,font:{family:'Inter',size:10},callback:function(v){return formatAxisDollars(v);}}}, y:{grid:{display:false}, ticks:{color:th.tickColorY,font:{family:'Inter',size:10,weight:'600'}}} } }
    });
}

function updateRecipientsChart(benefitData) {
    if (recipientsChart) { recipientsChart.destroy(); recipientsChart = null; }
    var th = getChartTheme();
    var ctx = document.getElementById('recipients-chart').getContext('2d');
    recipientsChart = new Chart(ctx, {
        type:'bar',
        data:{ labels:benefitData.map(function(d){return d.label;}), datasets:[{ label:'Recipients', data:benefitData.map(function(d){return d.count;}), backgroundColor:benefitData.map(function(d){return hexToRgba(d.color,0.75);}), borderColor:benefitData.map(function(d){return d.color;}), borderWidth:1, borderRadius:6 }] },
        options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
            plugins:{ legend:{display:false}, tooltip:{backgroundColor:th.tooltipBg, titleColor:th.tooltipTitle, bodyColor:th.tooltipBody, callbacks:{label:function(c){return formatNum(c.parsed.x)+' recipients';}}} },
            scales:{ x:{grid:{color:th.gridColor}, ticks:{color:th.tickColor,font:{family:'Inter',size:10},callback:function(v){return formatNumShort(v);}}}, y:{grid:{display:false}, ticks:{color:th.tickColorY,font:{family:'Inter',size:10,weight:'600'}}} } }
    });
}

function updateBenefitsTable(benefitData, totalPool, totalFilers) {
    var container = document.getElementById('benefits-table');
    var html = '<table class="data-table"><thead><tr><th>Benefit Type</th><th>Total Amount ($)</th><th>% of Total Pool</th><th>Recipients</th><th>% of Total Filers</th><th>Per Recipient</th></tr></thead><tbody>';
    benefitData.forEach(function(d) {
        var pctPool   = totalPool   > 0 ? (d.amount/totalPool)*100   : 0;
        var pctFilers = totalFilers > 0 ? (d.count/totalFilers)*100 : 0;
        html += '<tr><td>'+d.label+'</td><td>'+formatDollarsShort(d.amount)+'</td><td>'+pctPool.toFixed(1)+'%</td>';
        html += '<td>'+formatNum(d.count)+'</td><td>'+pctFilers.toFixed(1)+'%</td><td>'+formatDollars(d.perRecipient)+'</td></tr>';
    });
    html += '<tr class="total-row"><td><strong>Total Pool</strong></td><td><strong>'+formatDollarsShort(totalPool)+'</strong></td><td><strong>100%</strong></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>';
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ── Formatters ─────────────────────────────────────────────
function formatDollars(val) {
    if (val===null||val===undefined||isNaN(val)) return '—';
    return '$'+Math.round(val).toLocaleString('en-US');
}
function formatDollarsShort(val) {
    if (val===null||val===undefined||isNaN(val)) return '—';
    var a=Math.abs(val), s=val<0?'-':'';
    if (a>=1e12) return s+'$'+(a/1e12).toFixed(2)+'T';
    if (a>=1e9)  return s+'$'+(a/1e9).toFixed(1)+'B';
    if (a>=1e6)  return s+'$'+(a/1e6).toFixed(1)+'M';
    if (a>=1e3)  return s+'$'+(a/1e3).toFixed(0)+'K';
    return s+'$'+Math.round(a);
}
function formatAxisDollars(val) {
    if (val===0) return '0';
    var a=Math.abs(val), s=val<0?'-':'';
    if (a>=1e9) return s+'$'+(a/1e9).toFixed(0)+'B';
    if (a>=1e6) return s+'$'+(a/1e6).toFixed(0)+'M';
    if (a>=1e3) return s+'$'+(a/1e3).toFixed(0)+'K';
    return s+'$'+Math.round(a);
}
function formatNum(val) {
    if (val===null||val===undefined||isNaN(val)) return '—';
    return Math.round(val).toLocaleString('en-US');
}
function formatNumShort(val) {
    if (val===0) return '0';
    var a=Math.abs(val);
    if (a>=1e6) return (a/1e6).toFixed(1)+'M';
    if (a>=1e3) return (a/1e3).toFixed(0)+'K';
    return Math.round(a).toString();
}
function hexToRgba(hex, alpha) {
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
}

init();
