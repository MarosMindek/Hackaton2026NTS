<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDeliveryStore } from '@/stores/delivery'

const store = useDeliveryStore()
const s = computed(() => store.stats)
const fixDistricts = ref(false)
const fixResult    = ref<number | null>(null)

const routableCount = computed(() => {
  if (!s.value) return 0
  return s.value.total_packages - (s.value.unresolved ?? 0)
})

const assignedPct = computed(() => {
  if (!s.value || routableCount.value === 0) return 0
  return Math.round((s.value.assigned / routableCount.value) * 100)
})

// Zones with no driver at all vs zones where drivers ran out of capacity
const noCoverageZones = computed(() =>
  s.value?.zones.filter(z => z.drivers === 0 && z.unassigned > 0) ?? []
)
const capacityOverflowZones = computed(() =>
  s.value?.zones.filter(z => z.drivers > 0 && z.unassigned > 0) ?? []
)
const noCoverageCount = computed(() =>
  noCoverageZones.value.reduce((sum, z) => sum + z.unassigned, 0)
)
const capacityOverflowCount = computed(() =>
  capacityOverflowZones.value.reduce((sum, z) => sum + z.unassigned, 0)
)

function utilColor(pct: number): string {
  if (pct >= 85) return '#2BA94F'
  if (pct >= 50) return '#F99D20'
  return '#0647C9'
}

async function handleOptimize() {
  fixResult.value = null
  const data = await store.optimize(fixDistricts.value)
  if (fixDistricts.value && data) fixResult.value = data.districts_fixed
}

async function handleClear() {
  fixResult.value = null
  await store.clearAssignments()
}

const ZONE_COLORS: Record<string, string> = {
  'Staré Mesto': '#0647C9',
  'Sídlisko KVP': '#0960D3',
  'Sídlisko Ťahanovce': '#0999E8',
  'Dargovských hrdinov': '#162670',
  'Nad jazerom': '#1A308B',
  'Západ': '#0092B3',
  'Juh': '#5B5BD8',
  'Sever': '#7047B2',
  'Kavečany': '#A449A1',
  'Košická Nová Ves': '#2BA94F',
  'Šaca': '#A5CD39',
  'Barca': '#F1C40F',
  'Poľov': '#F99D20',
  'Lorinčík': '#F36E27',
  'Myslava': '#0092B3',
  'Pereš': '#535BD8',
  'Vyšné Opátske': '#0A1B51',
  'Krásna': '#0960D3',
}
function zoneColor(zone: string): string { return ZONE_COLORS[zone] ?? '#8EA0B8' }
</script>

<template>
  <div class="page">
    <div class="header">
      <div>
        <h1>Delivery Optimization</h1>
        <p class="sub">KE-Delivery s.r.o. — Košice fleet management</p>
      </div>
      <div class="actions">
        <label class="fix-toggle" :title="'Use ArcGIS polygon data to correct packages assigned to the wrong district before optimizing'">
          <input type="checkbox" v-model="fixDistricts" :disabled="store.optimizing" />
          <span>Fix districts</span>
        </label>
        <button v-if="s && s.assigned > 0" class="btn-ghost" @click="handleClear" :disabled="store.optimizing">
          Clear
        </button>
        <button class="btn-primary" @click="handleOptimize" :disabled="store.optimizing || store.loading">
          <span v-if="store.optimizing" class="spinner"></span>
          <span v-else>▶</span>
          {{ store.optimizing ? 'Optimizing…' : 'Run Optimization' }}
        </button>
      </div>
      <div v-if="fixResult !== null" class="fix-result">
        <span v-if="fixResult > 0">✓ {{ fixResult }} package district{{ fixResult === 1 ? '' : 's' }} corrected before optimization</span>
        <span v-else>✓ All districts already correct</span>
      </div>
    </div>

    <!-- ── Overall stats ── -->
    <div class="cards" v-if="s">
      <div class="card">
        <div class="card-value">{{ s.total_packages.toLocaleString() }}</div>
        <div class="card-label">Total packages</div>
      </div>
      <div class="card card-green">
        <div class="card-value">{{ s.assigned.toLocaleString() }}</div>
        <div class="card-label">Assigned — will be delivered</div>
      </div>
      <div class="card" :class="s.unassigned > 0 ? 'card-amber' : ''">
        <div class="card-value">{{ s.unassigned.toLocaleString() }}</div>
        <div class="card-label">Unassigned</div>
        <div class="card-breakdown" v-if="s.unassigned > 0">
          <span class="breakdown-chip no-driver" v-if="noCoverageCount > 0" :title="noCoverageZones.map(z => z.zone).join(', ')">
            {{ noCoverageCount }} no driver
          </span>
          <span class="breakdown-chip overflow" v-if="capacityOverflowCount > 0" :title="capacityOverflowZones.map(z => z.zone).join(', ')">
            {{ capacityOverflowCount }} over capacity
          </span>
        </div>
      </div>
      <div class="card" :class="(s.unresolved ?? 0) > 0 ? 'card-red' : ''">
        <div class="card-value">{{ (s.unresolved ?? 0).toLocaleString() }}</div>
        <div class="card-label">Unresolved — manual review needed</div>
      </div>
      <div class="card">
        <div class="card-value">{{ assignedPct }}%</div>
        <div class="card-label">Of routable packages assigned</div>
        <div class="card-sub">{{ s.assigned }} of {{ routableCount }} routable</div>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: assignedPct + '%', background: utilColor(assignedPct) }"></div>
        </div>
      </div>
    </div>

    <div v-if="!s && !store.loading" class="empty-state">
      <div class="empty-icon">🚚</div>
      <p>Click <strong>Run Optimization</strong> to assign packages to drivers.</p>
    </div>

    <div v-if="store.loading" class="loading-state">
      <span class="spinner-lg"></span>
      <span>Loading…</span>
    </div>

    <!-- ── Zone table ── -->
    <div v-if="s && s.zones.length" class="section">
      <h2>Zones <span class="badge">{{ s.zones.length }}</span></h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Zone</th>
              <th>Status</th>
              <th>Drivers</th>
              <th>Packages</th>
              <th>Assigned</th>
              <th>Unassigned</th>
              <th>Cap. (kg)</th>
              <th>Used (kg)</th>
              <th>Weight util.</th>
              <th>Cap. (L)</th>
              <th>Used (L)</th>
              <th>Vol. util.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="z in s.zones" :key="z.zone">
              <td class="zone-cell">
                <span class="zone-dot" :style="{ background: zoneColor(z.zone) }"></span>
                {{ z.zone }}
              </td>
              <td>
                <span v-if="z.drivers === 0 && z.total_packages > 0" class="zone-status no-driver-badge">No driver</span>
                <span v-else-if="z.unassigned > 0" class="zone-status overflow-badge">Over capacity</span>
                <span v-else-if="z.assigned === z.total_packages && z.total_packages > 0" class="zone-status ok-badge">Full coverage</span>
                <span v-else-if="z.total_packages === 0" class="zone-status empty-badge">No packages</span>
                <span v-else class="zone-status ok-badge">OK</span>
              </td>
              <td>{{ z.drivers }}</td>
              <td>{{ z.total_packages }}</td>
              <td class="assigned-cell">{{ z.assigned }}</td>
              <td :class="z.unassigned > 0 ? 'unassigned-cell' : ''">{{ z.unassigned }}</td>
              <td>{{ z.capacity_weight_kg.toLocaleString() }}</td>
              <td>{{ z.used_weight_kg.toLocaleString() }}</td>
              <td>
                <div class="inline-bar-wrap">
                  <div class="inline-bar-track">
                    <div class="inline-bar-fill"
                      :style="{ width: Math.min(z.weight_utilization_pct, 100) + '%', background: utilColor(z.weight_utilization_pct) }">
                    </div>
                  </div>
                  <span>{{ z.weight_utilization_pct }}%</span>
                </div>
              </td>
              <td>{{ (z.capacity_volume_m3 * 1000).toFixed(0) }}</td>
              <td>{{ (z.used_volume_m3 * 1000).toFixed(1) }}</td>
              <td>
                <div class="inline-bar-wrap">
                  <div class="inline-bar-track">
                    <div class="inline-bar-fill"
                      :style="{ width: Math.min(z.volume_utilization_pct, 100) + '%', background: utilColor(z.volume_utilization_pct) }">
                    </div>
                  </div>
                  <span>{{ z.volume_utilization_pct }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>


<style scoped>
.page { padding: 26px; max-width: 1400px; margin: 0 auto; }

.header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; padding: 18px 20px; border-radius: 18px; background: linear-gradient(135deg, var(--brand-surface) 0%, var(--brand-cyan-soft) 100%); border: 1px solid var(--brand-border); box-shadow: var(--brand-shadow-soft); }
h1 { font-size: 1.6rem; font-weight: 700; color: var(--brand-text); margin-bottom: 4px; }
.sub { color: var(--brand-muted); font-size: 0.9rem; }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

.fix-toggle {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.84rem; color: var(--brand-text-soft); cursor: pointer;
  padding: 6px 10px; border-radius: 7px; border: 1px solid var(--brand-border);
  background: var(--brand-surface-soft); user-select: none;
}
.fix-toggle input { cursor: pointer; }
.fix-toggle:has(input:checked) { border-color: var(--brand-cyan-border); background: var(--brand-blue-soft); color: var(--brand-blue); }

.fix-result {
  font-size: 0.82rem; color: #1D7F3E; background: var(--brand-success-soft);
  border: 1px solid var(--brand-success-border); border-radius: 7px;
  padding: 6px 14px; margin-top: 8px; font-weight: 500;
}

.btn-primary {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px; border-radius: 8px; border: none;
  background: var(--brand-blue); color: var(--brand-surface); font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: var(--brand-navy); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-ghost {
  padding: 10px 16px; border-radius: 8px; border: 1px solid var(--brand-border);
  background: var(--brand-surface); color: var(--brand-muted); font-size: 0.88rem; font-weight: 500;
  cursor: pointer;
}
.btn-ghost:hover { background: var(--brand-surface-soft); }

.spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: var(--brand-surface); border-radius: 50%; animation: spin 0.7s linear infinite;
}
.spinner-lg {
  width: 24px; height: 24px; border: 3px solid var(--brand-border);
  border-top-color: var(--brand-blue); border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
.card {
  background: linear-gradient(180deg, var(--brand-surface) 0%, var(--brand-surface-soft) 100%); border: 1px solid var(--brand-border); border-radius: 18px;
  padding: 20px; box-shadow: var(--brand-shadow-soft);
}
.card-green { border-left: 4px solid var(--brand-green); }
.card-amber { border-left: 4px solid var(--brand-amber); }
.card-red   { border-left: 4px solid var(--brand-orange); }
.card-value { font-size: 2rem; font-weight: 800; color: var(--brand-text); margin-bottom: 4px; }
.card-label { font-size: 0.82rem; color: var(--brand-muted); font-weight: 500; margin-bottom: 4px; }
.card-sub   { font-size: 0.75rem; color: var(--brand-muted-2); margin-bottom: 8px; }

.bar-track { height: 6px; background: var(--brand-subtle); border-radius: 99px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 99px; transition: width 0.4s; }

.empty-state { text-align: center; padding: 80px 20px; color: var(--brand-muted); }
.empty-icon  { font-size: 3rem; margin-bottom: 12px; }
.loading-state { display: flex; align-items: center; gap: 12px; padding: 40px; color: var(--brand-muted); justify-content: center; }

.section { margin-top: 8px; }
h2 { font-size: 1.05rem; font-weight: 700; color: var(--brand-text); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.badge { background: var(--brand-subtle); color: var(--brand-text-soft); font-size: 0.78rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }

.table-wrap { background: var(--brand-surface); border: 1px solid var(--brand-border); border-radius: 12px; overflow: auto; box-shadow: var(--brand-shadow-soft); }
table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
th { background: var(--brand-surface-soft); padding: 10px 14px; text-align: left; font-weight: 600; color: var(--brand-text-soft); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
td { padding: 10px 14px; border-bottom: 1px solid var(--brand-subtle); color: var(--brand-text-soft); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--brand-surface-soft); }

.zone-cell { display: flex; align-items: center; gap: 8px; }
.zone-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.assigned-cell { color: var(--brand-green); font-weight: 600; }
.unassigned-cell { color: var(--brand-orange); font-weight: 600; }

.zone-status { font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
.no-driver-badge  { background: var(--brand-danger-soft); color: var(--brand-orange); }
.overflow-badge   { background: var(--brand-warning-soft); color: #8A3F13; }
.ok-badge         { background: var(--brand-success-soft); color: var(--brand-green); }
.empty-badge      { background: var(--brand-subtle); color: var(--brand-muted-2); }

.card-breakdown { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 2px; }
.breakdown-chip { font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 99px; cursor: default; }
.breakdown-chip.no-driver { background: var(--brand-danger-soft); color: var(--brand-orange); }
.breakdown-chip.overflow  { background: var(--brand-warning-soft); color: #8A3F13; }

.inline-bar-wrap { display: flex; align-items: center; gap: 8px; }
.inline-bar-track { flex: 1; height: 6px; background: var(--brand-subtle); border-radius: 99px; overflow: hidden; min-width: 60px; }
.inline-bar-fill  { height: 100%; border-radius: 99px; transition: width 0.4s; }
</style>
