<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDeliveryStore, type DriverStat } from '@/stores/delivery'
import { exportDriverPDF, type RouteStats } from '@/utils/pdfExport'

const store   = useDeliveryStore()
const router  = useRouter()
const search  = ref('')
const selZone = ref('')
const pdfLoading  = ref<string | null>(null)

function showOnMap(driverId: string) {
  store.selectedDriverId = driverId
  router.push('/map')
}

async function downloadPDF(driver: DriverStat) {
  const pkgs = driverPackages.value[driver.driver_id] ?? []
  pdfLoading.value = driver.driver_id
  let route: RouteStats | null = null
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 8_000)
    try {
      const res  = await fetch(`/api/routes/${driver.driver_id}`, { signal: controller.signal })
      clearTimeout(tid)
      const feat = await res.json()
      const p    = feat?.properties
      if (p && p.distance_km != null) {
        route = {
          distance_km:        p.distance_km,
          drive_duration_min: p.drive_duration_min,
          est_delivery_min:   p.est_delivery_min,
          source:             p.source,
        }
      }
    } catch {
      clearTimeout(tid)
      // OSRM timed out or failed — generate PDF without route stats
    }
    try {
      await exportDriverPDF(driver, pkgs, route)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('PDF generation failed. Check the browser console for details.')
    }
  } finally {
    pdfLoading.value = null
  }
}

const zones = computed(() => {
  const s = store.stats
  if (!s) return [] as string[]
  return [...new Set(s.drivers.map((d) => d.zone_mestska_cast))].sort()
})

const filtered = computed<DriverStat[]>(() => {
  const s = store.stats
  if (!s) return []
  return s.drivers.filter((d) => {
    const q = search.value.toLowerCase()
    const matchSearch =
      !q ||
      d.first_name.toLowerCase().includes(q) ||
      d.last_name.toLowerCase().includes(q) ||
      d.driver_id.toLowerCase().includes(q) ||
      d.vehicle_make_model?.toLowerCase().includes(q) ||
      d.license_plate.toLowerCase().includes(q)
    const matchZone = !selZone.value || d.zone_mestska_cast === selZone.value
    return matchSearch && matchZone
  })
})

function utilColor(pct: number): string {
  if (pct >= 85) return '#2BA94F'
  if (pct >= 50) return '#F99D20'
  return '#0647C9'
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
function zoneColor(z: string) { return ZONE_COLORS[z] ?? '#8EA0B8' }

</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Drivers <span class="badge">{{ filtered.length }}</span></h1>
      <div class="filters">
        <input v-model="search" type="text" placeholder="Search name, plate, ID…" class="search" />
        <select v-model="selZone" class="zone-select">
          <option value="">All zones</option>
          <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
        </select>
      </div>
    </div>

    <div v-if="store.loading" class="loading">
      <span class="spinner-lg"></span> Loading…
    </div>

    <div v-else-if="!store.stats" class="empty">
      Run optimization first to see driver assignments.
    </div>

    <div v-else class="grid">
      <div
        v-for="d in filtered"
        :key="d.driver_id"
        class="driver-card"
        @click="router.push(`/driver/${d.driver_id}`)"
      >
        <div class="driver-head">
          <div class="driver-info">
            <div class="driver-name">{{ d.first_name }} {{ d.last_name }}</div>
            <div class="driver-meta">{{ d.driver_id }} · {{ d.license_plate }}</div>
            <div class="driver-vehicle">{{ d.vehicle_make_model }} · {{ d.vehicle_type }}</div>
          </div>
          <div class="driver-actions">
            <div class="zone-tag" :style="{ background: zoneColor(d.zone_mestska_cast) + '22', color: zoneColor(d.zone_mestska_cast), borderColor: zoneColor(d.zone_mestska_cast) + '55' }">
              {{ d.zone_mestska_cast }}
            </div>
            <button
              class="btn-map"
              title="Show route on map"
              @click.stop="showOnMap(d.driver_id)"
            >Map</button>
            <button
              class="btn-pdf"
              title="Download route sheet PDF"
              :disabled="pdfLoading === d.driver_id"
              @click.stop="downloadPDF(d)"
            >
              <span v-if="pdfLoading === d.driver_id" class="pdf-spinner"></span>
              <span v-else>PDF ↓</span>
            </button>
            <div class="card-arrow">›</div>
          </div>
        </div>

        <div class="driver-stats">
          <div class="stat-row">
            <span class="stat-label">Packages</span>
            <div class="stat-bar-wrap">
              <div class="stat-bar-track">
                <div class="stat-bar-fill"
                  :style="{ width: Math.min(d.count_utilization_pct, 100) + '%', background: utilColor(d.count_utilization_pct) }">
                </div>
              </div>
              <span class="stat-val">{{ d.assigned_packages }} / {{ d.max_packages_count }}</span>
            </div>
          </div>
          <div class="stat-row">
            <span class="stat-label">Weight</span>
            <div class="stat-bar-wrap">
              <div class="stat-bar-track">
                <div class="stat-bar-fill"
                  :style="{ width: Math.min(d.weight_utilization_pct, 100) + '%', background: utilColor(d.weight_utilization_pct) }">
                </div>
              </div>
              <span class="stat-val">{{ d.assigned_weight_kg.toFixed(0) }} / {{ d.max_weight_kg.toFixed(0) }} kg</span>
            </div>
          </div>
          <div class="stat-row">
            <span class="stat-label">Volume</span>
            <div class="stat-bar-wrap">
              <div class="stat-bar-track">
                <div class="stat-bar-fill"
                  :style="{ width: Math.min(d.volume_utilization_pct, 100) + '%', background: utilColor(d.volume_utilization_pct) }">
                </div>
              </div>
              <span class="stat-val">{{ (d.assigned_volume_m3 * 1000).toFixed(1) }} / {{ (d.max_volume_m3 * 1000).toFixed(0) }} L</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
h1 {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--brand-text);
  display: flex;
  align-items: center;
  gap: 10px;
}
.badge { background: var(--brand-border); color: var(--brand-text-soft); font-size: 0.82rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }

.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.search,
.zone-select {
  min-height: 40px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--brand-border-strong);
  font-size: 0.9rem;
  background: var(--brand-surface);
  color: var(--brand-text);
}
.search { width: min(260px, 100%); }
.zone-select { cursor: pointer; }

.loading { display: flex; align-items: center; gap: 12px; padding: 60px; justify-content: center; color: var(--brand-muted); }
.empty   { text-align: center; padding: 60px; color: var(--brand-muted); }
.spinner-lg { width: 24px; height: 24px; border: 3px solid var(--brand-border); border-top-color: var(--brand-blue); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
  gap: 14px;
}

.driver-card {
  background: var(--brand-surface);
  border: 1px solid var(--brand-border);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(10, 27, 81, 0.08);
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s, border-color 0.15s;
}
.driver-card:hover { box-shadow: 0 12px 28px rgba(10, 27, 81, 0.14); border-color: var(--brand-cyan-border); transform: translateY(-2px); }
.driver-card:active { transform: translateY(0); }

.driver-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 16px;
}

.driver-info { min-width: 0; }
.driver-name { font-weight: 800; font-size: 1rem; color: var(--brand-text); line-height: 1.2; }
.driver-meta { font-size: 0.78rem; color: var(--brand-muted-2); margin-top: 3px; overflow-wrap: anywhere; }
.driver-vehicle { font-size: 0.82rem; color: var(--brand-muted); margin-top: 2px; overflow-wrap: anywhere; }

.driver-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  flex-wrap: wrap;
  min-width: 0;
}
.zone-tag {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 99px;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 1;
}

.btn-map,
.btn-pdf {
  min-height: 30px;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s, border-color 0.1s;
}
.btn-map { border: 1px solid var(--brand-cyan-border); background: var(--brand-cyan-soft); color: var(--brand-light-blue); }
.btn-map:hover { background: var(--brand-cyan-soft); border-color: var(--brand-cyan-border); }

.btn-pdf { border: 1px solid var(--brand-blue-soft-strong); background: var(--brand-blue-soft); color: var(--brand-blue); }
.btn-pdf:hover:not(:disabled) { background: var(--brand-blue-soft); border-color: var(--brand-border-strong); }
.btn-pdf:disabled { opacity: 0.6; cursor: not-allowed; }
.pdf-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid var(--brand-border-strong);
  border-top-color: var(--brand-blue);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.card-arrow { color: var(--brand-muted-2); font-size: 1.25rem; flex-shrink: 0; line-height: 1; padding-inline: 2px; }

.driver-stats { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 9px; }

.stat-row { display: grid; grid-template-columns: 66px minmax(0, 1fr); align-items: center; gap: 10px; }
.stat-label { font-size: 0.75rem; color: var(--brand-muted-2); font-weight: 700; }
.stat-bar-wrap { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; }
.stat-bar-track { min-width: 0; height: 6px; background: var(--brand-subtle); border-radius: 99px; overflow: hidden; }
.stat-bar-fill  { height: 100%; border-radius: 99px; transition: width 0.4s; }
.stat-val { font-size: 0.75rem; color: var(--brand-text-soft); white-space: nowrap; min-width: 88px; text-align: right; font-weight: 600; }

@media (max-width: 720px) {
  .page { padding: 16px 12px 24px; }
  .header { align-items: stretch; }
  .filters { width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
  .search, .zone-select { width: 100%; min-width: 0; }
  .driver-head { grid-template-columns: 1fr; gap: 10px; padding: 14px; }
  .driver-actions { justify-content: flex-start; }
  .zone-tag { max-width: 100%; }
}

@media (max-width: 420px) {
  .page { padding-inline: 10px; }
  h1 { font-size: 1.3rem; }
  .filters { grid-template-columns: 1fr; }
  .driver-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    width: 100%;
    align-items: center;
  }
  .zone-tag { min-width: 0; }
  .btn-map,
  .btn-pdf { padding-inline: 9px; }
  .driver-stats { padding-inline: 14px; }
  .stat-row { grid-template-columns: 58px minmax(0, 1fr); gap: 8px; }
  .stat-bar-wrap { grid-template-columns: 1fr; gap: 4px; }
  .stat-val { min-width: 0; text-align: left; }
}

@media (max-width: 340px) {
  .driver-actions { grid-template-columns: 1fr 1fr; }
  .zone-tag { grid-column: 1 / -1; }
  .card-arrow { display: none; }
}
</style>
