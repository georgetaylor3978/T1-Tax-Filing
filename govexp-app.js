/* ═══════════════════════════════════════════════════════════════
   govexp-app.js — Government Expenses Tab (Tab 3)
   T1 Tax Data Dashboard

   Data: GOVEXP_DATA from govexp-data.js (pre-baked from Open Canada API)
   Features:
   - Department Group / Organization: multi-select checkbox dropdown
   - SOBJ (expense type) slicer buttons
   - Combine toggle: stacked bars vs combined bar
   - Income bracket selector → drives "Your Share" right Y-axis line
   - 3 KPI cards: Latest Spending, 10-yr Growth, Your Personal Cost
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ─────────────────────────────────────────────────────
var gx = {
    data: null,
    chart: null,
    selectedDepts: new Set(),   // Set of "type:id" strings (parent or all)
    selectedSlicers: new Set(),
    isCombineOn: true,
    selectedBracket: null,
    shareOfPool: 0              // fraction 0-1 from T1 data
};

// Colors
var GX_SLICER_COLORS = [
    '#f43f5e', '#3b82f6', '#f59e0b', '#06b6d4',
    '#10b981', '#8b5cf6', '#ec4899', '#a78bfa',
    '#34d399', '#fbbf24', '#60a5fa', '#f97316'
];

var GX_LINE_COLOR = '#00e5ff';  // cyan for "your share" line
var EMPTY_MAP_LABEL = '<EMPTY FIELD - MAP>';

// ── Init ──────────────────────────────────────────────────────
function gxInit() {
    if (typeof GOVEXP_DATA === 'undefined') {
        document.getElementById('gx-dataStatus').textContent = '⚠️ govexp-data.js not found — run update-govexp-data.js';
        document.getElementById('gx-dataStatus').className = 'gx-data-status gx-warning';
        return;
    }

    gx.data = GOVEXP_DATA;

    // Warn about unmapped orgs
    var unmapped = (gx.data.meta && gx.data.meta.unmappedOrgs) ? gx.data.meta.unmappedOrgs : [];
    if (unmapped.length > 0) {
        document.getElementById('gx-dataStatus').textContent = '⚠️ ' + unmapped.length + ' orgs need mapping';
        document.getElementById('gx-dataStatus').className = 'gx-data-status gx-warning';
    } else {
        document.getElementById('gx-dataStatus').textContent = '● Data Loaded';
        document.getElementById('gx-dataStatus').className = 'gx-data-status gx-loaded';
    }

    // Init all slicers as selected
    gx.data.slicerCats.forEach(function (_, i) { gx.selectedSlicers.add(i); });

    gxBuildBracketSelector();
    gxBuildDeptDropdown();
    gxBuildSlicers();
    gxSetupEvents();
}

// ── Bracket Selector ─────────────────────────────────────────
function gxBuildBracketSelector() {
    var sel = document.getElementById('gx-bracketSelect');
    if (!sel || !window.DATA || !window.DATA.bracketLabels) return;

    window.DATA.bracketLabels.forEach(function (b) {
        sel.add(new Option(b, b));
    });

    // Default: pick median-ish bracket (index ~10)
    var midIdx = Math.floor(window.DATA.bracketLabels.length / 2);
    gx.selectedBracket = window.DATA.bracketLabels[midIdx];
    sel.value = gx.selectedBracket;
    gxComputeShareOfPool();

    sel.addEventListener('change', function () {
        gx.selectedBracket = this.value;
        gxComputeShareOfPool();
        gxUpdateChart();
        gxUpdateCards();
    });
}

function gxComputeShareOfPool() {
    if (!window.DATA || !gx.selectedBracket) { gx.shareOfPool = 0; return; }
    var line106 = window.DATA.lineItems[106];
    if (!line106) { gx.shareOfPool = 0; return; }

    var totalTax = line106.brackets.Total.amount * 1000;
    var bracketTax = line106.brackets[gx.selectedBracket] ? line106.brackets[gx.selectedBracket].amount * 1000 : 0;
    var bracketFilers = line106.brackets[gx.selectedBracket] ? line106.brackets[gx.selectedBracket].count : 0;

    // Per capita tax for the selected individual
    var perCapitaTax = bracketFilers > 0 ? bracketTax / bracketFilers : 0;

    // Individual's true proportional share of the entire tax pool
    gx.shareOfPool = totalTax > 0 ? perCapitaTax / totalTax : 0;
}

// ── Department Multi-Select Dropdown ─────────────────────────
function gxBuildDeptDropdown() {
    var list = document.getElementById('gx-deptList');
    if (!list) return;

    var hierarchy = gxExtractHierarchy();
    var sortedParents = Object.keys(hierarchy).map(Number).sort(function (a, b) {
        var na = gx.data.parents[a], nb = gx.data.parents[b];
        if (na === EMPTY_MAP_LABEL) return 1;
        if (nb === EMPTY_MAP_LABEL) return -1;
        return na.localeCompare(nb);
    });

    var html = '';
    // "All Federal" option
    html += '<div class="gx-dd-item gx-is-parent" data-type="all" data-id="-1">' +
        '<input type="checkbox" class="gx-chk" id="gx-chk-all">' +
        '<label for="gx-chk-all"><span class="gx-dd-icon">🇨🇦</span>All (Total Federal)</label>' +
        '</div>';

    for (var d = 0; d < sortedParents.length; d++) {
        var pIdx = sortedParents[d];
        var parentName = gx.data.parents[pIdx];
        var isEmptyGroup = parentName === EMPTY_MAP_LABEL;
        var icon = isEmptyGroup ? '⚠️' : '🏛️';
        var style = isEmptyGroup ? ' style="color:#f59e0b"' : '';
        var chkId = 'gx-chk-p' + pIdx;

        html += '<div class="gx-dd-item gx-is-parent" data-type="parent" data-id="' + pIdx + '"' + style + '>' +
            '<input type="checkbox" class="gx-chk" id="' + chkId + '">' +
            '<label for="' + chkId + '">' +
            '<span class="gx-dd-icon">' + icon + '</span>' +
            parentName +
            '</label>' +
            '</div>';
    }

    list.innerHTML = html;
}

function gxExtractHierarchy() {
    var hierarchy = {};
    for (var i = 0; i < gx.data.data.length; i++) {
        var r = gx.data.data[i];
        var pIdx = r[1];
        if (!hierarchy[pIdx]) hierarchy[pIdx] = new Set();
        hierarchy[pIdx].add(r[2]);
    }
    return hierarchy;
}

// ── SOBJ Slicers ─────────────────────────────────────────────
function gxBuildSlicers() {
    var area = document.getElementById('gx-slicerArea');
    if (!area) return;
    var html = '';
    gx.data.slicerCats.forEach(function (cat, i) {
        var color = GX_SLICER_COLORS[i % GX_SLICER_COLORS.length];
        html += '<button class="slicer-btn active" data-id="' + i + '">' +
            '<span class="slicer-color-indicator" style="background-color:' + color + '"></span>' +
            cat + '</button>';
    });
    area.innerHTML = html;
}

// ── Events ────────────────────────────────────────────────────
function gxSetupEvents() {
    // Dept dropdown toggle
    var trigger = document.getElementById('gx-deptTrigger');
    var menu = document.getElementById('gx-deptMenu');
    if (trigger && menu) {
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.classList.toggle('open');
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#gx-deptDropdown')) menu.classList.remove('open');
        });
    }

    // Dept checkboxes
    var list = document.getElementById('gx-deptList');
    if (list) {
        list.addEventListener('change', function (e) {
            var chk = e.target;
            if (!chk.classList.contains('gx-chk')) return;
            var item = chk.closest('.gx-dd-item');
            var type = item.getAttribute('data-type');
            var id = Number(item.getAttribute('data-id'));
            if (type === 'all') {
                var isChecked = chk.checked;
                document.querySelectorAll('#gx-deptList .gx-chk').forEach(function (c) {
                    c.checked = isChecked;
                    var itm = c.closest('.gx-dd-item');
                    var t = itm.getAttribute('data-type');
                    var i = Number(itm.getAttribute('data-id'));
                    if (t !== 'all') {
                        if (isChecked) {
                            gx.selectedDepts.add(t + ':' + i);
                        } else {
                            gx.selectedDepts.delete(t + ':' + i);
                        }
                    }
                });
                if (isChecked) gx.selectedDepts.add('all:-1');
                else gx.selectedDepts.delete('all:-1');
            } else {
                var key = type + ':' + id;
                if (chk.checked) {
                    gx.selectedDepts.add(key);
                } else {
                    gx.selectedDepts.delete(key);
                    var master = document.getElementById('gx-chk-all');
                    if (master) master.checked = false;
                    gx.selectedDepts.delete('all:-1');
                }
            }
            gxUpdateTriggerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Clear All (Dept)
    var clearAll = document.getElementById('gx-clearAll');
    if (clearAll) {
        clearAll.addEventListener('click', function () {
            document.querySelectorAll('#gx-deptList .gx-chk').forEach(function (chk) { chk.checked = false; });
            gx.selectedDepts.clear();
            gxUpdateTriggerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Slicer Select All / Clear
    var slicerAll = document.getElementById('gx-slicerSelectAll');
    var slicerClear = document.getElementById('gx-slicerClear');
    if (slicerAll) {
        slicerAll.addEventListener('click', function () {
            gx.data.slicerCats.forEach(function (_, i) { gx.selectedSlicers.add(i); });
            document.querySelectorAll('.slicer-btn').forEach(function (b) { b.classList.add('active'); });
            gxUpdateChart();
            gxUpdateCards();
        });
    }
    if (slicerClear) {
        slicerClear.addEventListener('click', function () {
            gx.selectedSlicers.clear();
            document.querySelectorAll('.slicer-btn').forEach(function (b) { b.classList.remove('active'); });
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Slicers
    var slicerArea = document.getElementById('gx-slicerArea');
    if (slicerArea) {
        slicerArea.addEventListener('click', function (e) {
            var btn = e.target.closest('.slicer-btn');
            if (!btn) return;
            var id = Number(btn.getAttribute('data-id'));
            if (gx.selectedSlicers.has(id)) {
                if (gx.selectedSlicers.size === 1) return;
                gx.selectedSlicers.delete(id);
                btn.classList.remove('active');
            } else {
                gx.selectedSlicers.add(id);
                btn.classList.add('active');
            }
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Combine toggle
    var combineToggle = document.getElementById('gx-combineToggle');
    if (combineToggle) {
        combineToggle.addEventListener('change', function (e) {
            gx.isCombineOn = e.target.checked;
            gxUpdateChart();
        });
    }
}

function gxUpdateTriggerLabel() {
    var n = gx.selectedDepts.size;
    var label = document.querySelector('#gx-deptTrigger .gx-trigger-label');
    if (label) label.textContent = n === 0 ? 'Select departments…' : n + ' selected';
}

// ── Data Aggregation ─────────────────────────────────────────
function gxGetSeriesData(type, id) {
    var result = {};
    for (var i = 0; i < gx.data.data.length; i++) {
        var r = gx.data.data[i];
        var yIdx = r[0], pIdx = r[1], sIdx = r[3], amt = r[4];

        if (type === 'parent' && pIdx !== id) continue;
        if (!gx.selectedSlicers.has(sIdx)) continue;

        if (!result[yIdx]) result[yIdx] = { total: 0, bySlicer: {} };
        result[yIdx].total += amt;
        if (!result[yIdx].bySlicer[sIdx]) result[yIdx].bySlicer[sIdx] = 0;
        result[yIdx].bySlicer[sIdx] += amt;
    }
    return result;
}

function gxGetAllSeriesData() {
    // Aggregate across all selected departments
    var combined = {};
    gx.selectedDepts.forEach(function (key) {
        var parts = key.split(':');
        var type = parts[0], id = Number(parts[1]);
        var series = gxGetSeriesData(type, id);
        Object.keys(series).forEach(function (yIdx) {
            yIdx = Number(yIdx);
            if (!combined[yIdx]) combined[yIdx] = { total: 0, bySlicer: {} };
            combined[yIdx].total += series[yIdx].total;
            Object.keys(series[yIdx].bySlicer).forEach(function (sIdx) {
                sIdx = Number(sIdx);
                if (!combined[yIdx].bySlicer[sIdx]) combined[yIdx].bySlicer[sIdx] = 0;
                combined[yIdx].bySlicer[sIdx] += series[yIdx].bySlicer[sIdx];
            });
        });
    });
    return combined;
}

function gxGetDeptLabel() {
    if (gx.selectedDepts.size === 0) return 'No Departments';
    if (gx.selectedDepts.size === 1) {
        var key = Array.from(gx.selectedDepts)[0];
        var parts = key.split(':');
        var type = parts[0], id = Number(parts[1]);
        if (type === 'all') return 'All (Total Federal)';
        return gx.data.parents[id] || 'Unknown';
    }
    return gx.selectedDepts.size + ' Departments';
}

// ── Format Helpers ───────────────────────────────────────────
function gxFmt(val) {
    if (Math.abs(val) >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (Math.abs(val) >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (Math.abs(val) >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    if (Math.abs(val) >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(val);
}

// ── Chart ─────────────────────────────────────────────────────
function gxUpdateChart() {
    var ctx = document.getElementById('gx-chart');
    if (!ctx) return;

    var emptyState = document.getElementById('gx-emptyState');
    var chartWrapper = document.querySelector('#section-govexp .gx-chart-wrapper');

    if (gx.selectedDepts.size === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (chartWrapper) chartWrapper.classList.remove('active');
        if (gx.chart) { gx.chart.destroy(); gx.chart = null; }
        return;
    }
    if (emptyState) emptyState.classList.add('hidden');
    if (chartWrapper) chartWrapper.classList.add('active');

    var sortedYears = gx.data.years.slice().sort(function (a, b) { return a - b; });
    var labels = sortedYears.map(function (y) { return y + '-' + String(y + 1).slice(-2); });
    var combined = gxGetAllSeriesData();
    var datasets = [];

    if (!gx.isCombineOn) {
        // Stacked bars per SOBJ
        Array.from(gx.selectedSlicers).sort(function (a, b) { return a - b; }).forEach(function (sIdx) {
            var catName = gx.data.slicerCats[sIdx];
            var color = GX_SLICER_COLORS[sIdx % GX_SLICER_COLORS.length];
            var pts = sortedYears.map(function (yr) {
                var yIdx = gx.data.years.indexOf(yr);
                return (combined[yIdx] && combined[yIdx].bySlicer[sIdx]) ? combined[yIdx].bySlicer[sIdx] : 0;
            });
            datasets.push({
                type: 'bar', label: catName, data: pts,
                backgroundColor: color, borderColor: 'transparent',
                yAxisID: 'y', stack: 'main'
            });
        });
    } else {
        var pts = sortedYears.map(function (yr) {
            var yIdx = gx.data.years.indexOf(yr);
            return (combined[yIdx]) ? combined[yIdx].total : 0;
        });
        datasets.push({
            type: 'bar', label: gxGetDeptLabel(),
            data: pts,
            backgroundColor: 'rgba(59,130,246,0.5)',
            borderColor: '#3b82f6', borderWidth: 1,
            yAxisID: 'y'
        });
    }

    // Right axis: "Your Share" line
    var sharePts = sortedYears.map(function (yr) {
        var yIdx = gx.data.years.indexOf(yr);
        var total = (combined[yIdx]) ? combined[yIdx].total : 0;
        return total * gx.shareOfPool;
    });
    datasets.push({
        type: 'line',
        label: 'Your Share (' + (gx.selectedBracket || 'bracket') + ')',
        data: sharePts,
        borderColor: GX_LINE_COLOR,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: GX_LINE_COLOR,
        tension: 0.3,
        yAxisID: 'y1'
    });

    var scales = {
        x: { ticks: { color: '#8b95b0' }, grid: { color: 'rgba(255,255,255,0.04)' }, stacked: !gx.isCombineOn },
        y: {
            type: 'linear', position: 'left', stacked: !gx.isCombineOn,
            title: { display: true, text: 'Total Spending', color: '#8b95b0' },
            ticks: { color: '#8b95b0', callback: function (v) { return gxFmt(v); } },
            grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y1: {
            type: 'linear', position: 'right',
            title: { display: true, text: 'Your Share ($)', color: GX_LINE_COLOR },
            ticks: { color: GX_LINE_COLOR, callback: function (v) { return gxFmt(v); } },
            grid: { drawOnChartArea: false }
        }
    };

    if (gx.chart) gx.chart.destroy();
    gx.chart = new Chart(ctx, {
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#f0f4fc' } },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            return c.dataset.label + ': ' + gxFmt(c.parsed.y);
                        }
                    }
                }
            },
            scales: scales
        }
    });
}

// ── KPI Cards ─────────────────────────────────────────────────
function gxUpdateCards() {
    var combined = gxGetAllSeriesData();
    var sortedYIdxs = Object.keys(combined).map(Number).sort(function (a, b) {
        return gx.data.years[a] - gx.data.years[b];
    });

    if (sortedYIdxs.length === 0) {
        document.getElementById('gx-kpi-latest').textContent = '—';
        document.getElementById('gx-kpi-latest-sub').textContent = '—';
        document.getElementById('gx-kpi-growth').textContent = '—';
        document.getElementById('gx-kpi-growth-sub').textContent = '—';
        document.getElementById('gx-kpi-yourcost').textContent = '—';
        document.getElementById('gx-kpi-yourcost-sub').textContent = '—';
        return;
    }

    var latestYIdx = sortedYIdxs[sortedYIdxs.length - 1];
    var latestAmt = combined[latestYIdx].total;
    var latestYear = gx.data.years[latestYIdx];

    // Card 1: Latest spending
    document.getElementById('gx-kpi-latest').textContent = gxFmt(latestAmt);
    document.getElementById('gx-kpi-latest-sub').textContent = 'FY ' + latestYear + '-' + String(latestYear + 1).slice(-2);

    // Card 2: New Debt (Your Share)
    var debtIdx = gx.data.slicerCats.indexOf('Public debt charges');
    var growthEl = document.getElementById('gx-kpi-growth');
    var subEl = document.getElementById('gx-kpi-growth-sub');
    if (debtIdx >= 0 && combined[latestYIdx] && combined[latestYIdx].bySlicer[debtIdx] > 0) {
        var debtTarget = combined[latestYIdx].bySlicer[debtIdx];
        var debtShare = debtTarget * gx.shareOfPool;
        growthEl.textContent = gxFmt(debtShare);
        subEl.textContent = 'You borrowed an additional ' + gxFmt(debtShare) + ' in the most recent year';
        growthEl.style.color = '#f43f5e';
    } else {
        growthEl.textContent = '—';
        growthEl.style.color = '';
        subEl.textContent = 'No debt data for selection';
    }

    // Card 3: Your cost
    var yourCost = latestAmt * gx.shareOfPool;
    document.getElementById('gx-kpi-yourcost').textContent = gxFmt(yourCost);
    document.getElementById('gx-kpi-yourcost-sub').textContent =
        (gx.selectedBracket || '—') + ' bracket · FY ' + latestYear;
}

// ── Start when pane becomes visible ──────────────────────────
// We hook into the existing tab system — when the govexp tab is clicked,
// init on first visit.
var gxInitialized = false;

document.addEventListener('DOMContentLoaded', function () {
    // Listen for tab switches — our tab has data-tab="govexp"
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.getAttribute('data-tab') === 'govexp' && !gxInitialized) {
                gxInitialized = true;
                gxInit();
            }
        });
    });
});
