/* ═══════════════════════════════════════════
   T1 Tax Data — Dashboard Logic
   Tab 1: Your Tax Bracket — per-capita comparison
   Tab 2: Pensions & Benefits — high-level overview
   ═══════════════════════════════════════════ */

var DATA = null;
var selectedBracket = null;
var bracketBarChart = null;
var filersBarChart = null;
var benefitsChart = null;
var recipientsChart = null;

// Benefit line items to show on Tab 2
var BENEFIT_LINES = [
    { num: 7, label: 'Old Age Security (OAS)', color: '#06b6d4' },
    { num: 8, label: 'CPP/QPP Benefits', color: '#3b82f6' },
    { num: 9, label: 'Other Pensions & Superannuation', color: '#8b5cf6' },
    { num: 10, label: 'Elected Split-Pension', color: '#f59e0b' },
    { num: 11, label: 'Employment Insurance (EI)', color: '#f43f5e' },
    { num: 17, label: 'RRSP Income', color: '#10b981' }
];

// Chart colors for brackets
var BRACKET_COLORS = [
    '#6366f1', '#818cf8', '#a78bfa', '#c084fc',
    '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6',
    '#4c1d95', '#3b82f6', '#2563eb', '#1d4ed8',
    '#1e40af', '#06b6d4', '#0891b2', '#0e7490',
    '#10b981', '#f59e0b', '#f43f5e'
];

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
async function init() {
    try {
        var resp = await fetch('data.json');
        DATA = await resp.json();
        populateBracketSelector();
        setupTabs();
        selectedBracket = DATA.bracketLabels[0];
        document.getElementById('bracketSelect').value = selectedBracket;
        updateTab1();
        updateTab2();
        document.getElementById('dataStatus').innerHTML = '&#x25CF; Data Loaded';
    } catch (e) {
        console.error('Failed to load data:', e);
        document.getElementById('dataStatus').textContent = '✕ Load Failed';
        document.getElementById('dataStatus').classList.remove('loaded');
    }
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function setupTabs() {
    var btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-tab') === tab);
            });
            document.querySelectorAll('.tab-section').forEach(function (s) {
                s.classList.toggle('active', s.id === 'section-' + tab);
            });
            positionIndicator();
        });
    });
    positionIndicator();
    window.addEventListener('resize', positionIndicator);
}

function positionIndicator() {
    var active = document.querySelector('.tab-btn.active');
    var indicator = document.getElementById('tabIndicator');
    if (!active || !indicator) return;
    var bar = document.querySelector('.tab-bar-content');
    var barRect = bar.getBoundingClientRect();
    var btnRect = active.getBoundingClientRect();
    indicator.style.left = (btnRect.left - barRect.left) + 'px';
    indicator.style.width = btnRect.width + 'px';
}

// ══════════════════════════════════════════
// BRACKET SELECTOR
// ══════════════════════════════════════════
function populateBracketSelector() {
    var sel = document.getElementById('bracketSelect');
    DATA.bracketLabels.forEach(function (b) {
        sel.add(new Option(b, b));
    });
    sel.addEventListener('change', function () {
        selectedBracket = this.value;
        updateTab1();
    });
}

// ══════════════════════════════════════════
// TAB 1: YOUR TAX BRACKET
// ══════════════════════════════════════════
function updateTab1() {
    var line106 = DATA.lineItems[106]; // Total tax payable
    var line3 = DATA.lineItems[3];     // Total number of returns

    var brackets = DATA.bracketLabels;
    var totalTax = line106.brackets.Total.amount * 1000;
    var totalFilers = line3.brackets.Total.count;
    var population = DATA.population;

    // Per-capita by bracket (for median calc)
    var perCapitaByBracket = brackets.map(function (b) {
        var tax = line106.brackets[b].amount * 1000;
        var count = line106.brackets[b].count;
        return count > 0 ? tax / count : 0;
    });

    // Median filer: find bracket where cumulative filers crosses 50% of total taxable filers
    // Use line 1 (taxable returns) for median — the median person is a taxpayer
    var line1 = DATA.lineItems[1];
    var taxableFilers = line1.brackets.Total.count;
    var cumulative = 0;
    var medianPerCapita = 0;
    var medianBracketLabel = '';
    for (var mi = 0; mi < brackets.length; mi++) {
        var bCount = line1.brackets[brackets[mi]].count;
        cumulative += bCount;
        if (cumulative >= taxableFilers / 2) {
            medianPerCapita = perCapitaByBracket[mi];
            medianBracketLabel = brackets[mi];
            break;
        }
    }

    // Selected bracket data
    var myTax = line106.brackets[selectedBracket].amount * 1000;
    var myFilers = line106.brackets[selectedBracket].count;
    var myPerCapita = myFilers > 0 ? myTax / myFilers : 0;
    var avgCanadian = totalTax / population;
    var avgFiler = totalTax / totalFilers;
    var vsMedian = medianPerCapita > 0 ? myPerCapita / medianPerCapita : 0;

    // Update KPI cards
    document.getElementById('kpi-your-tax').textContent = formatDollars(myPerCapita);
    document.getElementById('kpi-your-tax-sub').textContent = formatNum(myFilers) + ' filers in this bracket';

    document.getElementById('kpi-avg-canadian').textContent = formatDollars(avgCanadian);
    document.getElementById('kpi-avg-canadian-sub').textContent = 'Pop: ' + formatNum(population);

    document.getElementById('kpi-avg-filer').textContent = formatDollars(avgFiler);
    document.getElementById('kpi-avg-filer-sub').textContent = formatNum(totalFilers) + ' total filers';

    document.getElementById('kpi-median-filer').textContent = formatDollars(medianPerCapita);
    document.getElementById('kpi-median-filer-sub').textContent = 'Bracket: ' + medianBracketLabel;

    var vsMedianEl = document.getElementById('kpi-share');
    vsMedianEl.textContent = vsMedian.toFixed(1) + '×';
    vsMedianEl.className = 'card-value ' + (vsMedian >= 1 ? (vsMedian > 1.5 ? 'negative' : '') : 'positive');
    document.getElementById('kpi-share-sub').textContent = formatDollars(myPerCapita) + ' vs ' + formatDollars(medianPerCapita) + ' median';

    // Top Earner Stat (Top 2 Brackets)
    var top2Brackets = brackets.slice(-2);
    var top2Filers = 0;
    var top2Tax = 0;
    top2Brackets.forEach(function (b) {
        top2Filers += line106.brackets[b].count;
        top2Tax += line106.brackets[b].amount * 1000;
    });
    var pctPop = (top2Filers / population) * 100;
    var pctTax = (top2Tax / totalTax) * 100;
    document.getElementById('top-earner-stat').textContent = 'The top ' + pctPop.toFixed(1) + '% pay ' + pctTax.toFixed(1) + '% of all personal tax';

    // Charts
    updateBracketBarChart(line106, brackets, perCapitaByBracket);
    updateFilersBarChart(line106, brackets, perCapitaByBracket);
    updateBracketTable(line106, line3, brackets, totalTax, population);
}

function updateBracketBarChart(line106, brackets, perCapitaByBracket) {
    if (bracketBarChart) { bracketBarChart.destroy(); bracketBarChart = null; }

    var bgColors = brackets.map(function (b, i) {
        return b === selectedBracket ? '#ffffff' : BRACKET_COLORS[i % BRACKET_COLORS.length];
    });

    var borderColors = brackets.map(function (b, i) {
        return b === selectedBracket ? '#06b6d4' : 'transparent';
    });

    var borderWidths = brackets.map(function (b) {
        return b === selectedBracket ? 3 : 0;
    });

    var ctx = document.getElementById('bracket-bar-chart').getContext('2d');
    bracketBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: brackets,
            datasets: [{
                label: 'Per-Capita Tax Payable',
                data: perCapitaByBracket,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: borderWidths,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 21, 32, 0.95)',
                    titleColor: '#f0f4fc', bodyColor: '#8b95b0',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    cornerRadius: 8, padding: 12,
                    callbacks: {
                        label: function (ctx) { return 'Per person: ' + formatDollars(ctx.parsed.x); }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#5a6580', font: { family: 'Inter', size: 10 },
                        callback: function (v) { return formatAxisDollars(v); }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#8b95b0', font: { family: 'Inter', size: 10, weight: '500' } }
                }
            }
        }
    });
}

function updateFilersBarChart(line106, brackets, perCapitaByBracket) {
    if (filersBarChart) { filersBarChart.destroy(); filersBarChart = null; }

    var filerData = brackets.map(function (b) {
        return line106.brackets[b].count;
    });

    var bgColors = brackets.map(function (b, i) {
        return b === selectedBracket ? '#ffffff' : BRACKET_COLORS[i % BRACKET_COLORS.length];
    });

    var borderColors = brackets.map(function (b) {
        return b === selectedBracket ? '#06b6d4' : 'rgba(0,0,0,0)';
    });
    var borderWidths = brackets.map(function (b) {
        return b === selectedBracket ? 3 : 0;
    });

    var ctx = document.getElementById('filers-bar-chart').getContext('2d');
    filersBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: brackets,
            datasets: [
                {
                    label: 'Tax Filers',
                    data: filerData,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: borderWidths,
                    borderRadius: 4,
                    yAxisID: 'yLeft',
                    order: 2
                },
                {
                    label: 'Avg Tax Per Filer',
                    data: perCapitaByBracket,
                    type: 'line',
                    borderColor: '#06b6d4',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#0a0e17',
                    pointBorderWidth: 1.5,
                    tension: 0.3,
                    yAxisID: 'yRight',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#8b95b0',
                        font: { family: 'Inter', size: 10 },
                        padding: 10,
                        boxWidth: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 21, 32, 0.95)',
                    titleColor: '#f0f4fc', bodyColor: '#8b95b0',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    cornerRadius: 8, padding: 12,
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.dataset.label === 'Tax Filers') return formatNum(ctx.parsed.y) + ' filers';
                            return 'Avg tax: ' + formatDollars(ctx.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#5a6580', font: { family: 'Inter', size: 9 },
                        maxRotation: 45, minRotation: 45
                    }
                },
                yLeft: {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#5a6580', font: { family: 'Inter', size: 10 },
                        callback: function (v) { return formatNumShort(v); }
                    }
                },
                yRight: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#06b6d4', font: { family: 'Inter', size: 10 },
                        callback: function (v) { return formatAxisDollars(v); }
                    }
                }
            }
        }
    });
}

function updateBracketTable(line106, line3, brackets, totalTax, population) {
    var container = document.getElementById('bracket-table');
    var html = '<table class="data-table"><thead><tr>';
    html += '<th>Bracket</th><th>Filers</th><th>Tax Payable ($)</th>';
    html += '<th>Per Capita</th><th>Share of Pool</th>';
    html += '</tr></thead><tbody>';

    brackets.forEach(function (b) {
        var count = line106.brackets[b].count;
        var amount = line106.brackets[b].amount * 1000;
        var perCapita = count > 0 ? amount / count : 0;
        var share = totalTax > 0 ? (amount / totalTax) * 100 : 0;
        var isSelected = b === selectedBracket;
        html += '<tr' + (isSelected ? ' class="highlight"' : '') + '>';
        html += '<td>' + b + '</td>';
        html += '<td>' + formatNum(count) + '</td>';
        html += '<td>' + formatDollarsShort(amount) + '</td>';
        html += '<td>' + formatDollars(perCapita) + '</td>';
        html += '<td>' + share.toFixed(1) + '%</td>';
        html += '</tr>';
    });

    // Total row
    var totalCount = line106.brackets.Total.count;
    var totalAmount = line106.brackets.Total.amount * 1000;
    var totalPerCapita = totalCount > 0 ? totalAmount / totalCount : 0;
    html += '<tr class="total-row"><td><strong>All Filers</strong></td>';
    html += '<td><strong>' + formatNum(totalCount) + '</strong></td>';
    html += '<td><strong>' + formatDollarsShort(totalAmount) + '</strong></td>';
    html += '<td><strong>' + formatDollars(totalPerCapita) + '</strong></td>';
    html += '<td><strong>100%</strong></td></tr>';
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ══════════════════════════════════════════
// TAB 2: PENSIONS & BENEFITS
// ══════════════════════════════════════════
function updateTab2() {
    var line106 = DATA.lineItems[106];
    var line59 = DATA.lineItems[59];  // Taxable income assessed
    var totalTax = line106.brackets.Total.amount * 1000;
    var totalTaxableIncome = line59.brackets.Total.amount * 1000;

    var totalPool = 0;
    var totalRecipients = 0;
    var benefitData = [];

    BENEFIT_LINES.forEach(function (bl) {
        var item = DATA.lineItems[bl.num];
        if (!item) return;
        var amount = item.brackets.Total.amount * 1000;
        var count = item.brackets.Total.count;
        totalPool += amount;
        if (count > totalRecipients) totalRecipients = count; // Requested: MAX of subcategories
        benefitData.push({
            label: bl.label,
            color: bl.color,
            amount: amount,
            count: count,
            pctOfTaxableIncome: totalTaxableIncome > 0 ? (amount / totalTaxableIncome) * 100 : 0,
            perRecipient: count > 0 ? amount / count : 0
        });
    });

    // KPI cards
    document.getElementById('ben-pool').textContent = formatDollarsShort(totalPool);
    var poolPct = totalTaxableIncome > 0 ? (totalPool / totalTaxableIncome) * 100 : 0;
    document.getElementById('ben-pct').textContent = poolPct.toFixed(1) + '%';
    document.getElementById('ben-pct-sub').textContent = formatDollarsShort(totalPool) + ' of ' + formatDollarsShort(totalTaxableIncome) + ' taxable income';
    document.getElementById('ben-recipients').textContent = formatNum(totalRecipients);
    document.getElementById('ben-avg').textContent = formatDollars(totalRecipients > 0 ? totalPool / totalRecipients : 0);

    // Total tax filers for % of recipients calculation
    var line3 = DATA.lineItems[3];
    var totalFilers = line3 ? line3.brackets.Total.count : 0;

    // Sort data for charts (largest to smallest)
    var sortedByAmount = benefitData.slice().sort(function (a, b) { return b.amount - a.amount; });
    var sortedByCount = benefitData.slice().sort(function (a, b) { return b.count - a.count; });

    // Charts
    updateBenefitsChart(sortedByAmount);
    updateRecipientsChart(sortedByCount);
    updateBenefitsTable(benefitData, totalPool, totalFilers);
}

function updateBenefitsChart(benefitData) {
    if (benefitsChart) { benefitsChart.destroy(); benefitsChart = null; }

    var ctx = document.getElementById('benefits-chart').getContext('2d');
    benefitsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: benefitData.map(function (d) { return d.label; }),
            datasets: [{
                label: 'Total Amount',
                data: benefitData.map(function (d) { return d.amount; }),
                backgroundColor: benefitData.map(function (d) { return hexToRgba(d.color, 0.75); }),
                borderColor: benefitData.map(function (d) { return d.color; }),
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 21, 32, 0.95)',
                    titleColor: '#f0f4fc', bodyColor: '#8b95b0',
                    callbacks: {
                        label: function (ctx) { return formatDollarsShort(ctx.parsed.x); }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#5a6580', font: { family: 'Inter', size: 10 },
                        callback: function (v) { return formatAxisDollars(v); }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#8b95b0', font: { family: 'Inter', size: 10, weight: '600' } }
                }
            }
        }
    });
}

function updateRecipientsChart(benefitData) {
    if (recipientsChart) { recipientsChart.destroy(); recipientsChart = null; }

    var ctx = document.getElementById('recipients-chart').getContext('2d');
    recipientsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: benefitData.map(function (d) { return d.label; }),
            datasets: [{
                label: 'Recipients',
                data: benefitData.map(function (d) { return d.count; }),
                backgroundColor: benefitData.map(function (d) { return hexToRgba(d.color, 0.75); }),
                borderColor: benefitData.map(function (d) { return d.color; }),
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 21, 32, 0.95)',
                    titleColor: '#f0f4fc', bodyColor: '#8b95b0',
                    callbacks: {
                        label: function (ctx) { return formatNum(ctx.parsed.x) + ' recipients'; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#5a6580', font: { family: 'Inter', size: 10 },
                        callback: function (v) { return formatNumShort(v); }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#8b95b0', font: { family: 'Inter', size: 10, weight: '600' } }
                }
            }
        }
    });
}

function updateBenefitsTable(benefitData, totalPool, totalFilers) {
    var container = document.getElementById('benefits-table');
    var html = '<table class="data-table"><thead><tr>';
    html += '<th>Benefit Type</th><th>Total Amount ($)</th>';
    html += '<th>% of Total Pool</th>';
    html += '<th>Recipients</th><th>% of Total Filers</th><th>Per Recipient</th>';
    html += '</tr></thead><tbody>';

    benefitData.forEach(function (d) {
        html += '<tr>';
        html += '<td>' + d.label + '</td>';
        html += '<td>' + formatDollarsShort(d.amount) + '</td>';
        var pctPool = totalPool > 0 ? (d.amount / totalPool) * 100 : 0;
        html += '<td>' + pctPool.toFixed(1) + '%</td>';
        html += '<td>' + formatNum(d.count) + '</td>';
        var pctFilers = totalFilers > 0 ? (d.count / totalFilers) * 100 : 0;
        html += '<td>' + pctFilers.toFixed(1) + '%</td>';
        html += '<td>' + formatDollars(d.perRecipient) + '</td>';
        html += '</tr>';
    });

    // Total row
    html += '<tr class="total-row">';
    html += '<td><strong>Total Pool</strong></td>';
    html += '<td><strong>' + formatDollarsShort(totalPool) + '</strong></td>';
    html += '<td><strong>100%</strong></td>';
    html += '<td>&mdash;</td>';
    html += '<td>&mdash;</td>';
    html += '<td>&mdash;</td>';
    html += '</tr>';
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ══════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════
function formatDollars(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return '$' + Math.round(val).toLocaleString('en-US');
}

function formatDollarsShort(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    var absVal = Math.abs(val);
    var sign = val < 0 ? '-' : '';
    if (absVal >= 1e12) return sign + '$' + (absVal / 1e12).toFixed(2) + 'T';
    if (absVal >= 1e9) return sign + '$' + (absVal / 1e9).toFixed(1) + 'B';
    if (absVal >= 1e6) return sign + '$' + (absVal / 1e6).toFixed(1) + 'M';
    if (absVal >= 1e3) return sign + '$' + (absVal / 1e3).toFixed(0) + 'K';
    return sign + '$' + Math.round(absVal);
}

function formatAxisDollars(val) {
    if (val === 0) return '0';
    var absVal = Math.abs(val);
    var sign = val < 0 ? '-' : '';
    if (absVal >= 1e9) return sign + '$' + (absVal / 1e9).toFixed(0) + 'B';
    if (absVal >= 1e6) return sign + '$' + (absVal / 1e6).toFixed(0) + 'M';
    if (absVal >= 1e3) return sign + '$' + (absVal / 1e3).toFixed(0) + 'K';
    return sign + '$' + Math.round(absVal);
}

function formatNum(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Math.round(val).toLocaleString('en-US');
}

function formatNumShort(val) {
    if (val === 0) return '0';
    var absVal = Math.abs(val);
    if (absVal >= 1e6) return (absVal / 1e6).toFixed(1) + 'M';
    if (absVal >= 1e3) return (absVal / 1e3).toFixed(0) + 'K';
    return Math.round(absVal).toString();
}

function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

// ── Start ──
init();
