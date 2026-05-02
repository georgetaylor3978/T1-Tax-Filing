/* govexp-app.js — Government Expenses Section */
'use strict';

var gx = {
    data: null,
    chart: null,
    selectedDepts: new Set(),
    selectedSlicers: new Set(),
    isCombineOn: true,
    selectedBracket: null,
    perCapitaTax: 0
};

var GX_SLICER_COLORS = [
    '#f43f5e','#3b82f6','#f59e0b','#06b6d4',
    '#10b981','#8b5cf6','#ec4899','#a78bfa',
    '#34d399','#fbbf24','#60a5fa','#f97316'
];
var GX_LINE_COLOR = '#00e5ff';
var EMPTY_MAP_LABEL = '<EMPTY FIELD - MAP>';

// ── Init ──────────────────────────────────────────────────
function gxInit() {
    if (typeof GOVEXP_DATA === 'undefined') {
        document.getElementById('gx-dataStatus').textContent = '⚠️ govexp-data.js not found';
        document.getElementById('gx-dataStatus').className = 'gx-data-status gx-warning';
        return;
    }
    gx.data = GOVEXP_DATA;
    var unmapped = (gx.data.meta && gx.data.meta.unmappedOrgs) ? gx.data.meta.unmappedOrgs : [];
    if (unmapped.length > 0) {
        document.getElementById('gx-dataStatus').textContent = '⚠️ ' + unmapped.length + ' orgs need mapping';
        document.getElementById('gx-dataStatus').className = 'gx-data-status gx-warning';
    } else {
        document.getElementById('gx-dataStatus').textContent = '● Data Loaded';
        document.getElementById('gx-dataStatus').className = 'gx-data-status gx-loaded';
    }

    gx.data.slicerCats.forEach(function(_, i) { gx.selectedSlicers.add(i); });

    gxBuildBracketSelector();
    gxBuildDeptDropdown();
    gxBuildSlicerDropdown();
    gxSetupEvents();
}

// ── Bracket Selector ──────────────────────────────────────
// app.js populates both selectors and wires them together.
// Here we just read the current value (already set by app.js) and compute share.
function gxBuildBracketSelector() {
    var sel = document.getElementById('gx-bracketSelect');
    if (!sel || !window.DATA || !window.DATA.bracketLabels) return;
    // Use whatever app.js already selected (window.selectedBracket)
    gx.selectedBracket = window.selectedBracket || sel.value || window.DATA.bracketLabels[0];
    sel.value = gx.selectedBracket;
    gxComputeShareOfPool();
}

function gxComputeShareOfPool() {
    if (!window.DATA || !gx.selectedBracket) { gx.perCapitaTax = 0; return; }
    var line106 = window.DATA.lineItems[106];
    if (!line106) { gx.perCapitaTax = 0; return; }
    var bracketTax    = line106.brackets[gx.selectedBracket] ? line106.brackets[gx.selectedBracket].amount * 1000 : 0;
    var bracketFilers = line106.brackets[gx.selectedBracket] ? line106.brackets[gx.selectedBracket].count : 0;
    gx.perCapitaTax = bracketFilers > 0 ? bracketTax / bracketFilers : 0;
}

// ── Department Multi-Select Dropdown ──────────────────────
function gxBuildDeptDropdown() {
    var list = document.getElementById('gx-deptList');
    if (!list) return;
    var hierarchy = gxExtractHierarchy();
    var sortedParents = Object.keys(hierarchy).map(Number).sort(function(a, b) {
        var na = gx.data.parents[a], nb = gx.data.parents[b];
        if (na === EMPTY_MAP_LABEL) return 1;
        if (nb === EMPTY_MAP_LABEL) return -1;
        return na.localeCompare(nb);
    });
    var html = '';
    // NOTE: "All (Total Federal)" is a SELECT-ALL convenience, NOT a data series.
    html += '<div class="gx-dd-item gx-is-parent" data-type="all" data-id="-1">' +
        '<input type="checkbox" class="gx-chk" id="gx-chk-all">' +
        '<label for="gx-chk-all"><span class="gx-dd-icon">🇨🇦</span>Select All Departments</label>' +
        '</div>';
    for (var d = 0; d < sortedParents.length; d++) {
        var pIdx = sortedParents[d];
        var parentName = gx.data.parents[pIdx];
        var isEmptyGroup = parentName === EMPTY_MAP_LABEL;
        var icon  = isEmptyGroup ? '⚠️' : '🏛️';
        var style = isEmptyGroup ? ' style="color:#f59e0b"' : '';
        var chkId = 'gx-chk-p' + pIdx;
        html += '<div class="gx-dd-item gx-is-parent" data-type="parent" data-id="' + pIdx + '"' + style + '>' +
            '<input type="checkbox" class="gx-chk" id="' + chkId + '">' +
            '<label for="' + chkId + '"><span class="gx-dd-icon">' + icon + '</span>' + parentName + '</label>' +
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

// ── SOBJ Slicer Dropdown ──────────────────────────────────
function gxBuildSlicerDropdown() {
    var list = document.getElementById('gx-slicerList');
    if (!list) return;
    var html = '';
    gx.data.slicerCats.forEach(function(cat, i) {
        var color = GX_SLICER_COLORS[i % GX_SLICER_COLORS.length];
        var chkId = 'gx-slicer-chk-' + i;
        html += '<div class="gx-dd-item" data-slicer-id="' + i + '">' +
            '<input type="checkbox" class="gx-chk gx-slicer-chk" id="' + chkId + '" checked data-id="' + i + '">' +
            '<label for="' + chkId + '"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:4px;flex-shrink:0;"></span>' + cat + '</label>' +
            '</div>';
    });
    list.innerHTML = html;
    gxUpdateSlicerLabel();
}

function gxUpdateSlicerLabel() {
    var lbl = document.querySelector('#gx-slicerTrigger .gx-trigger-label');
    if (!lbl) return;
    var total = gx.data ? gx.data.slicerCats.length : 0;
    var sel   = gx.selectedSlicers.size;
    lbl.textContent = sel === total ? 'All types selected' : sel + ' of ' + total + ' selected';
}

// ── Events ────────────────────────────────────────────────
function gxSetupEvents() {
    // Generic dropdown toggle helper
    function setupDropdown(triggerId, menuId) {
        var trigger = document.getElementById(triggerId);
        var menu    = document.getElementById(menuId);
        if (!trigger || !menu) return;
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            // close other menus
            document.querySelectorAll('.gx-menu.open').forEach(function(m) {
                if (m !== menu) m.classList.remove('open');
            });
            menu.classList.toggle('open');
        });
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#' + menuId) && !e.target.closest('#' + triggerId)) {
                menu.classList.remove('open');
            }
        });
    }
    setupDropdown('gx-deptTrigger', 'gx-deptMenu');
    setupDropdown('gx-slicerTrigger', 'gx-slicerMenu');

    // Dept checkboxes
    var list = document.getElementById('gx-deptList');
    if (list) {
        list.addEventListener('change', function(e) {
            var chk  = e.target;
            if (!chk.classList.contains('gx-chk')) return;
            var item = chk.closest('.gx-dd-item');
            var type = item.getAttribute('data-type');
            var id   = Number(item.getAttribute('data-id'));
            if (type === 'all') {
                // "Select All" checkbox — toggles all individual parent depts
                var isChecked = chk.checked;
                gx.selectedDepts.clear();
                document.querySelectorAll('#gx-deptList .gx-chk').forEach(function(c) {
                    c.checked = isChecked;
                    var itm = c.closest('.gx-dd-item');
                    var t   = itm.getAttribute('data-type');
                    var i   = Number(itm.getAttribute('data-id'));
                    if (t === 'parent') {
                        if (isChecked) gx.selectedDepts.add('parent:' + i);
                    }
                });
            } else {
                var key = type + ':' + id;
                if (chk.checked) gx.selectedDepts.add(key);
                else {
                    gx.selectedDepts.delete(key);
                    var master = document.getElementById('gx-chk-all');
                    if (master) master.checked = false;
                }
            }
            gxUpdateTriggerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Clear Depts
    var clearAll = document.getElementById('gx-clearAll');
    if (clearAll) {
        clearAll.addEventListener('click', function() {
            document.querySelectorAll('#gx-deptList .gx-chk').forEach(function(c){ c.checked=false; });
            gx.selectedDepts.clear();
            gxUpdateTriggerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Slicer checkboxes in dropdown
    var slicerList = document.getElementById('gx-slicerList');
    if (slicerList) {
        slicerList.addEventListener('change', function(e) {
            var chk = e.target;
            if (!chk.classList.contains('gx-slicer-chk')) return;
            var id = Number(chk.getAttribute('data-id'));
            if (chk.checked) gx.selectedSlicers.add(id);
            else {
                if (gx.selectedSlicers.size === 1) { chk.checked = true; return; } // keep at least 1
                gx.selectedSlicers.delete(id);
            }
            gxUpdateSlicerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Slicer Select All
    var slicerAll = document.getElementById('gx-slicerSelectAll');
    if (slicerAll) {
        slicerAll.addEventListener('click', function() {
            gx.data.slicerCats.forEach(function(_, i){ gx.selectedSlicers.add(i); });
            document.querySelectorAll('.gx-slicer-chk').forEach(function(c){ c.checked=true; });
            gxUpdateSlicerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }
    // Slicer None
    var slicerClear = document.getElementById('gx-slicerClear');
    if (slicerClear) {
        slicerClear.addEventListener('click', function() {
            gx.selectedSlicers.clear();
            // keep first one to avoid empty
            gx.selectedSlicers.add(0);
            document.querySelectorAll('.gx-slicer-chk').forEach(function(c){
                c.checked = Number(c.getAttribute('data-id')) === 0;
            });
            gxUpdateSlicerLabel();
            gxUpdateChart();
            gxUpdateCards();
        });
    }

    // Combine toggle
    var combineToggle = document.getElementById('gx-combineToggle');
    if (combineToggle) {
        combineToggle.addEventListener('change', function(e) {
            gx.isCombineOn = e.target.checked;
            gxUpdateChart();
        });
    }

    // Default: select all departments
    var chkAll = document.getElementById('gx-chk-all');
    if (chkAll) {
        chkAll.checked = true;
        chkAll.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function gxUpdateTriggerLabel() {
    var n = gx.selectedDepts.size;
    var label = document.querySelector('#gx-deptTrigger .gx-trigger-label');
    if (label) label.textContent = n === 0 ? 'Select departments…' : n + ' dept(s) selected';
}

// ── Data Aggregation ──────────────────────────────────────
function gxGetTotalFed(yIdx) {
    if (gx._totalFedByYear && gx._totalFedByYear[yIdx] !== undefined) return gx._totalFedByYear[yIdx];
    if (!gx._totalFedByYear) gx._totalFedByYear = {};
    var total = 0;
    for (var i = 0; i < gx.data.data.length; i++) {
        if (gx.data.data[i][0] === yIdx) total += gx.data.data[i][4];
    }
    gx._totalFedByYear[yIdx] = total;
    return total;
}

function gxGetSeriesData(type, id) {
    var result = {};
    for (var i = 0; i < gx.data.data.length; i++) {
        var r = gx.data.data[i];
        var yIdx=r[0], pIdx=r[1], sIdx=r[3], amt=r[4];
        if (type === 'parent' && pIdx !== id) continue;
        if (!gx.selectedSlicers.has(sIdx)) continue;
        if (!result[yIdx]) result[yIdx] = { total:0, bySlicer:{} };
        result[yIdx].total += amt;
        if (!result[yIdx].bySlicer[sIdx]) result[yIdx].bySlicer[sIdx] = 0;
        result[yIdx].bySlicer[sIdx] += amt;
    }
    return result;
}

function gxGetAllSeriesData() {
    // Only aggregate over individual parent depts (never 'all' type — avoid double count)
    var combined = {};
    gx.selectedDepts.forEach(function(key) {
        var parts = key.split(':');
        var type = parts[0];
        if (type === 'all') return; // skip — would double count
        var id = Number(parts[1]);
        var series = gxGetSeriesData(type, id);
        Object.keys(series).forEach(function(yIdx) {
            yIdx = Number(yIdx);
            if (!combined[yIdx]) combined[yIdx] = { total:0, bySlicer:{} };
            combined[yIdx].total += series[yIdx].total;
            Object.keys(series[yIdx].bySlicer).forEach(function(sIdx) {
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
        var key   = Array.from(gx.selectedDepts)[0];
        var parts = key.split(':');
        return gx.data.parents[Number(parts[1])] || 'Unknown';
    }
    return gx.selectedDepts.size + ' Departments';
}

function gxFmt(val) {
    if (Math.abs(val) >= 1e12) return '$' + (val/1e12).toFixed(1) + 'T';
    if (Math.abs(val) >= 1e9)  return '$' + (val/1e9).toFixed(1)  + 'B';
    if (Math.abs(val) >= 1e6)  return '$' + (val/1e6).toFixed(1)  + 'M';
    if (Math.abs(val) >= 1e3)  return '$' + (val/1e3).toFixed(1)  + 'K';
    return '$' + Math.round(val);
}

// ── Chart ─────────────────────────────────────────────────
function gxUpdateChart() {
    var ctx          = document.getElementById('gx-chart');
    if (!ctx) return;
    var emptyState   = document.getElementById('gx-emptyState');
    var chartWrapper = document.querySelector('#section-govexp .gx-chart-wrapper');
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    var gridColor   = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)';
    var tickColor   = dark ? '#8b95b0' : '#4b5475';
    var legendColor = dark ? '#f0f4fc' : '#1a1f35';

    if (gx.selectedDepts.size === 0) {
        if (emptyState)   emptyState.classList.remove('hidden');
        if (chartWrapper) chartWrapper.classList.remove('active');
        if (gx.chart)   { gx.chart.destroy(); gx.chart = null; }
        return;
    }
    if (emptyState)   emptyState.classList.add('hidden');
    if (chartWrapper) chartWrapper.classList.add('active');

    var sortedYears = gx.data.years.slice().sort(function(a,b){ return a-b; });
    var labels      = sortedYears.map(function(y){ return y+'-'+String(y+1).slice(-2); });
    var combined    = gxGetAllSeriesData();
    var datasets    = [];

    if (!gx.isCombineOn) {
        Array.from(gx.selectedSlicers).sort(function(a,b){return a-b;}).forEach(function(sIdx) {
            var color = GX_SLICER_COLORS[sIdx % GX_SLICER_COLORS.length];
            var pts = sortedYears.map(function(yr) {
                var yIdx = gx.data.years.indexOf(yr);
                return (combined[yIdx] && combined[yIdx].bySlicer[sIdx]) ? combined[yIdx].bySlicer[sIdx] : 0;
            });
            datasets.push({ type:'bar', label:gx.data.slicerCats[sIdx], data:pts, backgroundColor:color, borderColor:'transparent', yAxisID:'y', stack:'main' });
        });
    } else {
        var pts = sortedYears.map(function(yr) {
            var yIdx = gx.data.years.indexOf(yr);
            return combined[yIdx] ? combined[yIdx].total : 0;
        });
        datasets.push({ type:'bar', label:gxGetDeptLabel(), data:pts, backgroundColor:'rgba(59,130,246,0.5)', borderColor:'#3b82f6', borderWidth:1, yAxisID:'y' });
    }

    // Your Share line
    var latestYIdxChart = gx.data.years.indexOf(sortedYears[sortedYears.length - 1]);
    var fedTotalLatest  = gxGetTotalFed(latestYIdxChart) || 1;
    var fixedRatio      = gx.perCapitaTax / fedTotalLatest;
    var sharePts = sortedYears.map(function(yr) {
        var yIdx  = gx.data.years.indexOf(yr);
        var total = combined[yIdx] ? combined[yIdx].total : 0;
        return total * fixedRatio;
    });
    datasets.push({
        type:'line', label:'Your Share (' + (gx.selectedBracket || 'bracket') + ')',
        data:sharePts, borderColor:'#f43f5e', backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, pointBackgroundColor:'#f43f5e', tension:0.3, yAxisID:'y1'
    });

    if (gx.chart) gx.chart.destroy();
    gx.chart = new Chart(ctx, {
        data: { labels:labels, datasets:datasets },
        options: {
            responsive:true, maintainAspectRatio:false,
            interaction:{ mode:'index', intersect:false },
            plugins: {
                legend: { position:'top', align:'start', labels:{ color:legendColor, font:{family:'Inter',size:11}, padding:12, usePointStyle:true } },
                tooltip: { callbacks: { label: function(c){ return c.dataset.label+': '+gxFmt(c.parsed.y); } } }
            },
            scales: {
                x: { ticks:{color:tickColor}, grid:{color:gridColor}, stacked:!gx.isCombineOn,
                    title:{display:true, text:'Fiscal Year', color:tickColor} },
                y: { type:'linear', position:'left', stacked:!gx.isCombineOn,
                    title:{display:true, text:'Total Spending ($)', color:tickColor},
                    ticks:{color:tickColor, callback:function(v){ return gxFmt(v); }},
                    grid:{color:gridColor} },
                y1: { type:'linear', position:'right',
                    title:{display:true, text:'Your Share ($)', color:'#f43f5e'},
                    ticks:{color:'#f43f5e', callback:function(v){ return gxFmt(v); }},
                    grid:{drawOnChartArea:false}, beginAtZero:true }
            }
        }
    });
}

// ── KPI Cards ─────────────────────────────────────────────
function gxUpdateCards() {
    var combined    = gxGetAllSeriesData();
    var sortedYIdxs = Object.keys(combined).map(Number).sort(function(a,b){ return gx.data.years[a]-gx.data.years[b]; });
    var blank = function(ids) { ids.forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent='—'; }); };

    if (sortedYIdxs.length === 0) {
        blank(['gx-kpi-latest','gx-kpi-latest-sub','gx-kpi-yourcost','gx-kpi-yourcost-sub',
               'gx-kpi-newdebt','gx-kpi-newdebt-sub','gx-kpi-growth','gx-kpi-growth-sub',
               'gx-kpi-outdebt','gx-kpi-outdebt-sub','gx-kpi-debtbal','gx-kpi-debtbal-sub']);
        return;
    }

    var latestYIdx = sortedYIdxs[sortedYIdxs.length - 1];
    var latestAmt  = combined[latestYIdx].total;
    var latestYear = gx.data.years[latestYIdx];
    var fedTotal   = gxGetTotalFed(latestYIdx) || 1;

    // Total Spending
    document.getElementById('gx-kpi-latest').textContent     = gxFmt(latestAmt);
    document.getElementById('gx-kpi-latest-sub').textContent = 'FY ' + latestYear + '-' + String(latestYear+1).slice(-2);

    // Your Share (of spending)
    var yourCost = gx.perCapitaTax * (latestAmt / fedTotal);
    document.getElementById('gx-kpi-yourcost').textContent     = gxFmt(yourCost);
    document.getElementById('gx-kpi-yourcost-sub').textContent = (gx.selectedBracket || '—') + ' bracket · FY ' + latestYear;

    // New Debt (total)
    var debtIdx = gx.data.slicerCats.indexOf('Public debt charges');
    if (debtIdx >= 0 && combined[latestYIdx] && combined[latestYIdx].bySlicer[debtIdx] > 0) {
        var newDebtTotal = combined[latestYIdx].bySlicer[debtIdx];
        document.getElementById('gx-kpi-newdebt').textContent     = gxFmt(newDebtTotal);
        document.getElementById('gx-kpi-newdebt-sub').textContent = 'Total new debt added · FY ' + latestYear;
        // Your Share of New Debt
        var debtShare = gx.perCapitaTax * (newDebtTotal / fedTotal);
        document.getElementById('gx-kpi-growth').textContent     = gxFmt(debtShare);
        document.getElementById('gx-kpi-growth-sub').textContent = 'Your personal share of new debt · FY ' + latestYear;
    } else {
        document.getElementById('gx-kpi-newdebt').textContent     = '—';
        document.getElementById('gx-kpi-newdebt-sub').textContent = 'No debt data for selection';
        document.getElementById('gx-kpi-growth').textContent      = '—';
        document.getElementById('gx-kpi-growth-sub').textContent  = 'No debt data for selection';
    }

    // Outstanding Debt Balance (total)
    if (gx.data.debtBalanceByYear && gx.data.debtBalanceByYear[latestYear]) {
        var totalDebtBal  = gx.data.debtBalanceByYear[latestYear];
        var debtBalShare  = gx.perCapitaTax * (totalDebtBal / fedTotal);
        document.getElementById('gx-kpi-outdebt').textContent     = gxFmt(totalDebtBal);
        document.getElementById('gx-kpi-outdebt-sub').textContent = 'Cumulative national debt · FY ' + latestYear;
        document.getElementById('gx-kpi-debtbal').textContent     = gxFmt(debtBalShare);
        document.getElementById('gx-kpi-debtbal-sub').textContent = 'Your weighted share of ' + gxFmt(totalDebtBal) + ' balance';
    } else {
        document.getElementById('gx-kpi-outdebt').textContent     = '—';
        document.getElementById('gx-kpi-outdebt-sub').textContent = 'Data not available';
        document.getElementById('gx-kpi-debtbal').textContent     = '—';
        document.getElementById('gx-kpi-debtbal-sub').textContent = 'Data not available for ' + latestYear;
    }
}

// ── Lazy init: wait for DATA from app.js ─────────────────
var gxInitialized = false;

function gxTryInit() {
    if (gxInitialized) return;
    if (typeof GOVEXP_DATA === 'undefined') return;
    if (!window.DATA) return;
    gxInitialized = true;
    gxInit();
}

document.addEventListener('t1-data-ready', gxTryInit);

document.addEventListener('DOMContentLoaded', function() {
    // Try immediately (data may already be available in local file context)
    gxTryInit();
    // Also poll briefly as a fallback
    var attempts = 0;
    var poll = setInterval(function() {
        gxTryInit();
        if (gxInitialized || ++attempts > 20) clearInterval(poll);
    }, 300);
});
