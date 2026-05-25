<template>
  <div class="driver-route">

    <!-- ── Sticky header ─────────────────────────────────────────────── -->
    <header class="drv-header">
      <div class="drv-header-top">
        <div class="drv-name">{{ today?.first_name }} {{ today?.last_name }}</div>
        <div class="drv-date">{{ dateLabel }}</div>
      </div>
      <div class="drv-chips" v-if="today">
        <span class="chip chip-pending">{{ today.pending }} pending</span>
        <span class="chip chip-ok">{{ today.delivered }} delivered</span>
        <span class="chip chip-fail">{{ today.failed }} failed</span>
      </div>
      <div class="drv-progress" v-if="today && today.stops.length">
        <div class="drv-progress-bar">
          <div class="drv-progress-ok"  :style="{ width: deliveredPct + '%' }"></div>
          <div class="drv-progress-err" :style="{ width: failedPct + '%', left: deliveredPct + '%' }"></div>
        </div>
        <span class="drv-progress-label">{{ doneCount }} / {{ today.stops.length }}</span>
      </div>
    </header>

    <!-- ── Loading / error states ────────────────────────────────────── -->
    <div v-if="loading" class="drv-state">Loading route…</div>
    <div v-else-if="error" class="drv-state drv-state-err">{{ error }}</div>

    <template v-else-if="today">

      <!-- ── Map ──────────────────────────────────────────────────────── -->
      <section class="drv-map-section">
        <button class="map-toggle" @click="mapOpen = !mapOpen">
          <span>{{ mapOpen ? '▲' : '▼' }}</span> {{ mapOpen ? 'Hide map' : 'Show map' }}
        </button>
        <div v-show="mapOpen" ref="mapEl" class="drv-map"></div>
      </section>

      <!-- ── Filter tabs ───────────────────────────────────────────────── -->
      <div class="filter-tabs">
        <button
          v-for="tab in ['all','pending','delivered','failed']"
          :key="tab"
          :class="['filter-tab', { active: activeFilter === tab }]"
          @click="activeFilter = tab"
        >{{ tab }}</button>
      </div>

      <!-- ── Stop list ─────────────────────────────────────────────────── -->
      <ul class="stop-list">
        <li
          v-for="stop in filteredStops"
          :key="stop.package_id"
          :class="['stop-item', stopClass(stop)]"
          @click="selectStop(stop)"
        >
          <div class="stop-seq">{{ stop.sequence_number }}</div>
          <div class="stop-body">
            <div class="stop-recipient">{{ stop.recipient_name }}</div>
            <div class="stop-address">{{ stop.address }}</div>
            <div class="stop-meta">
              <span :class="['pri-badge', priBadgeClass(stop.priority)]">{{ stop.priority }}</span>
              <span v-if="stop.fragile" class="flag-badge">⚠ Fragile</span>
              <span v-if="stop.cod_amount_eur" class="flag-badge cod-badge">COD {{ stop.cod_amount_eur.toFixed(2) }} €</span>
            </div>
          </div>
          <div class="stop-status-icon">{{ statusIcon(stop) }}</div>
        </li>
      </ul>

    </template>

    <!-- ── Stop detail bottom sheet ─────────────────────────────────── -->
    <Transition name="sheet">
      <div v-if="selected" class="sheet-backdrop" @click.self="closeSheet">
        <div class="sheet">
          <div class="sheet-handle"></div>

          <!-- scrollable details -->
          <div class="sheet-scroll">
            <div class="sheet-header">
              <span class="sheet-seq">#{{ selected.sequence_number }}</span>
              <span :class="['pri-badge', priBadgeClass(selected.priority)]">{{ selected.priority }}</span>
              <button class="sheet-close" @click="closeSheet">✕</button>
            </div>

            <div class="sheet-recipient">{{ selected.recipient_name }}</div>
            <div class="sheet-address">{{ selected.address }}</div>
            <div class="sheet-barcode">{{ selected.barcode }} · {{ selected.weight_kg.toFixed(1) }} kg</div>

            <div v-if="selected.fragile" class="sheet-warn">⚠ Fragile — handle with care</div>
            <div v-if="selected.geocode_status === 'street'" class="sheet-warn warn-street">
              ~ Street-level GPS — confirm house number on arrival
            </div>
            <div v-if="selected.special_instructions" class="sheet-note">
              {{ selected.special_instructions }}
            </div>
            <div v-if="selected.cod_amount_eur" class="sheet-cod">
              Cash on delivery: {{ selected.cod_amount_eur.toFixed(2) }} €
            </div>
          </div>

          <!-- sticky action footer — always visible -->
          <div class="sheet-footer">
            <a
              class="nav-btn"
              :href="`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`"
              target="_blank"
              rel="noopener"
            >Navigate ↗</a>

            <template v-if="!selected.status">
              <div class="sheet-actions">
                <button class="action-btn action-ok" @click="markDelivered(selected)">✓ Delivered</button>
                <button class="action-btn action-fail" @click="openFailPicker">✗ Failed</button>
              </div>
            </template>

            <template v-else-if="selected.status === 'delivered'">
              <div class="sheet-done sheet-done-ok">✓ Marked as delivered</div>
              <div v-if="selected.note" class="sheet-done-note">{{ selected.note }}</div>
              <button class="undo-btn" @click="undoStatus(selected)">↩ Undo</button>
            </template>

            <template v-else-if="selected.status === 'failed'">
              <div class="sheet-done sheet-done-fail">✗ Failed — {{ reasonLabel(selected.reason) }}</div>
              <div v-if="selected.note" class="sheet-done-note">{{ selected.note }}</div>
              <button class="undo-btn" @click="undoStatus(selected)">↩ Undo</button>
            </template>
          </div>

        </div>
      </div>
    </Transition>

    <!-- ── Failure reason picker ─────────────────────────────────────── -->
    <Transition name="sheet">
      <div v-if="failPickerOpen" class="sheet-backdrop" @click.self="failPickerOpen = false">
        <div class="sheet fail-sheet">
          <div class="sheet-handle"></div>

          <div class="sheet-scroll">
            <div class="sheet-title">Why couldn't you deliver?</div>
            <div class="reason-grid">
              <button
                v-for="r in FAILURE_REASONS"
                :key="r"
                :class="['reason-btn', { selected: failReason === r }]"
                @click="failReason = r"
              >{{ reasonLabel(r) }}</button>
            </div>
            <textarea
              class="fail-note"
              v-model="failNote"
              placeholder="Optional note…"
              rows="2"
            ></textarea>
          </div>

          <div class="sheet-footer">
            <button
              class="action-btn action-fail"
              :disabled="!failReason"
              @click="submitFailed"
            >Confirm failed</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat } from 'ol/proj'
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stop {
  sequence_number:      number
  package_id:           number
  barcode:              string
  recipient_name:       string
  address:              string
  weight_kg:            number
  priority:             string
  fragile:              boolean
  cod_amount_eur:       number | null
  special_instructions: string | null
  geocode_status:       string | null
  lat:                  number
  lon:                  number
  status:               string | null
  reason:               string | null
  note:                 string | null
}

interface TodayResponse {
  driver_id:  string
  first_name: string
  last_name:  string
  date:       string
  stops:      Stop[]
  delivered:  number
  failed:     number
  pending:    number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FAILURE_REASONS = [
  'nobody_home', 'refused', 'wrong_address',
  'access_blocked', 'damaged', 'rescheduled', 'other',
]

const REASON_LABELS: Record<string, string> = {
  nobody_home:    'Nobody home',
  refused:        'Refused',
  wrong_address:  'Wrong address',
  access_blocked: 'Access blocked',
  damaged:        'Damaged',
  rescheduled:    'Rescheduled',
  other:          'Other',
}

const PRIORITY_COLORS: Record<string, string> = {
  Overnight: '#F36E27',
  Expres: '#F99D20',
  Štandard: '#0647C9',
  Ekonomický: '#8EA0B8',
}

// ── State ─────────────────────────────────────────────────────────────────────

const route     = useRoute()
const driverId  = computed(() => route.params.driverId as string)

const loading  = ref(true)
const error    = ref<string | null>(null)
const today    = ref<TodayResponse | null>(null)

const activeFilter  = ref<'all' | 'pending' | 'delivered' | 'failed'>('all')
const selected      = ref<Stop | null>(null)
const failPickerOpen = ref(false)
const failReason    = ref<string>('')
const failNote      = ref<string>('')

const mapOpen = ref(false)
const mapEl   = ref<HTMLElement | null>(null)
let olMap: Map | null = null
let stopsLayer: VectorLayer<VectorSource> | null = null

// ── Computed ──────────────────────────────────────────────────────────────────

const dateLabel = computed(() => {
  if (!today.value) return ''
  return new Date(today.value.date).toLocaleDateString('sk-SK', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
})

const doneCount = computed(() => (today.value?.delivered ?? 0) + (today.value?.failed ?? 0))

const deliveredPct = computed(() => {
  const t = today.value
  if (!t || !t.stops.length) return 0
  return (t.delivered / t.stops.length) * 100
})
const failedPct = computed(() => {
  const t = today.value
  if (!t || !t.stops.length) return 0
  return (t.failed / t.stops.length) * 100
})

const filteredStops = computed(() => {
  if (!today.value) return []
  const stops = today.value.stops
  if (activeFilter.value === 'all')       return stops
  if (activeFilter.value === 'pending')   return stops.filter(s => !s.status)
  if (activeFilter.value === 'delivered') return stops.filter(s => s.status === 'delivered')
  if (activeFilter.value === 'failed')    return stops.filter(s => s.status === 'failed')
  return stops
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function reasonLabel(r: string | null) {
  return r ? (REASON_LABELS[r] ?? r) : ''
}

function stopClass(stop: Stop) {
  if (stop.status === 'delivered') return 'stop-delivered'
  if (stop.status === 'failed')    return 'stop-failed'
  return 'stop-pending'
}

function statusIcon(stop: Stop) {
  if (stop.status === 'delivered') return '✓'
  if (stop.status === 'failed')    return '✗'
  return '→'
}

function priBadgeClass(priority: string) {
  const map: Record<string, string> = {
    Overnight:  'pri-overnight',
    Expres:     'pri-expres',
    Štandard:   'pri-standard',
    Ekonomický: 'pri-eco',
  }
  return map[priority] ?? ''
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch(`/api/driver/${driverId.value}/today`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    today.value = await res.json()
  } catch (e) {
    error.value = `Could not load route: ${String(e)}`
  } finally {
    loading.value = false
  }
}

// ── Map ───────────────────────────────────────────────────────────────────────

function buildMap() {
  if (!mapEl.value || !today.value?.stops.length) return

  const stops = today.value.stops
  const coords = stops.map(s => fromLonLat([s.lon, s.lat]))

  const routeFeature = new Feature(new LineString(coords))
  routeFeature.setStyle(new Style({
    stroke: new Stroke({ color: '#0647C9', width: 3, lineDash: [6, 4] }),
  }))

  const stopFeatures = stops.map(s => {
    const f = new Feature(new Point(fromLonLat([s.lon, s.lat])))
    const color = s.status === 'delivered' ? '#2BA94F'
                : s.status === 'failed'    ? '#F36E27'
                : PRIORITY_COLORS[s.priority] ?? '#0647C9'
    f.setStyle(new Style({
      image: new CircleStyle({
        radius: 10,
        fill:   new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
      text: new Text({
        text:       String(s.sequence_number),
        fill:       new Fill({ color: '#fff' }),
        font:       'bold 9px sans-serif',
        offsetY:    0.5,
      }),
    }))
    f.set('stop', s)
    return f
  })

  const source = new VectorSource({ features: [routeFeature, ...stopFeatures] })
  stopsLayer   = new VectorLayer({ source })

  olMap = new Map({
    target: mapEl.value,
    layers: [new TileLayer({ source: new OSM() }), stopsLayer],
    view:   new View({ center: coords[0], zoom: 13 }),
  })

  // fit to all stops
  const extent = source.getExtent()
  olMap.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 15 })

  // click on stop → select it
  olMap.on('click', evt => {
    olMap!.forEachFeatureAtPixel(evt.pixel, feature => {
      const s = feature.get('stop') as Stop | undefined
      if (s) { selectStop(s); return true }
    })
  })
}

function refreshMapStyles() {
  if (!stopsLayer || !today.value) return
  const source = stopsLayer.getSource()!
  source.getFeatures().forEach(f => {
    const s = f.get('stop') as Stop | undefined
    if (!s) return
    // find updated stop
    const updated = today.value!.stops.find(x => x.package_id === s.package_id)
    if (!updated) return
    const color = updated.status === 'delivered' ? '#2BA94F'
                : updated.status === 'failed'    ? '#F36E27'
                : PRIORITY_COLORS[updated.priority] ?? '#0647C9'
    f.setStyle(new Style({
      image: new CircleStyle({
        radius: 10,
        fill:   new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
      text: new Text({
        text:    String(updated.sequence_number),
        fill:    new Fill({ color: '#fff' }),
        font:    'bold 9px sans-serif',
        offsetY: 0.5,
      }),
    }))
    f.set('stop', updated)
  })
  stopsLayer.changed()
}

// ── Actions ───────────────────────────────────────────────────────────────────

function selectStop(stop: Stop) {
  selected.value = stop
  // pan map to this stop
  if (olMap) {
    olMap.getView().animate({ center: fromLonLat([stop.lon, stop.lat]), duration: 300 })
  }
}

function closeSheet() {
  selected.value = null
}

function openFailPicker() {
  failReason.value = ''
  failNote.value   = ''
  failPickerOpen.value = true
}

async function markDelivered(stop: Stop) {
  const res = await fetch(`/api/driver/${driverId.value}/packages/${stop.package_id}/delivered`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: null }),
  })
  if (!res.ok) return
  const updated: Stop = await res.json()
  patchStop(updated)
  selected.value = { ...stop, ...updated }
  refreshMapStyles()
}

async function submitFailed() {
  if (!selected.value || !failReason.value) return
  const res = await fetch(`/api/driver/${driverId.value}/packages/${selected.value.package_id}/failed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: failReason.value, note: failNote.value || null }),
  })
  if (!res.ok) return
  const updated: Stop = await res.json()
  patchStop(updated)
  selected.value = { ...selected.value, ...updated }
  failPickerOpen.value = false
  refreshMapStyles()
}

async function undoStatus(stop: Stop) {
  const res = await fetch(`/api/driver/${driverId.value}/packages/${stop.package_id}/status`, {
    method: 'DELETE',
  })
  if (!res.ok) return
  patchStop({ ...stop, status: null, reason: null, note: null })
  selected.value = { ...stop, status: null, reason: null, note: null }
  refreshMapStyles()
}

function patchStop(updated: Stop) {
  if (!today.value) return
  const idx = today.value.stops.findIndex(s => s.package_id === updated.package_id)
  if (idx === -1) return
  today.value.stops[idx] = { ...today.value.stops[idx], ...updated }
  // recount summary
  today.value.delivered = today.value.stops.filter(s => s.status === 'delivered').length
  today.value.failed    = today.value.stops.filter(s => s.status === 'failed').length
  today.value.pending   = today.value.stops.filter(s => !s.status).length
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  await load()
  if (today.value?.stops.length) {
    await nextTick()
    buildMap()
  }
})

watch(mapOpen, async (open) => {
  if (open && !olMap) {
    await nextTick()
    buildMap()
  } else if (open && olMap) {
    await nextTick()
    olMap.updateSize()
  }
})

onUnmounted(() => {
  olMap?.setTarget(undefined)
  olMap = null
})
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────── */
.driver-route {
  min-height: 100dvh;
  background: linear-gradient(180deg, var(--brand-border) 0%, var(--brand-surface-soft) 120px, var(--brand-subtle) 100%);
  font-family: var(--font-body);
  overflow-x: hidden;
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
  color: var(--brand-text);
}

button,
a {
  touch-action: manipulation;
}

/* ── Header ────────────────────────────────────────────────────────── */
.drv-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: radial-gradient(circle at 95% 0%, rgba(9,153,232,.28), transparent 38%), linear-gradient(135deg, var(--brand-maastricht), var(--brand-navy) 64%, var(--brand-blue));
  color: var(--brand-surface-soft);
  padding: 12px 14px 10px;
  box-shadow: 0 8px 24px rgba(10, 27, 81, .26);
}
.drv-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.drv-name {
  min-width: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.drv-date {
  flex-shrink: 0;
  max-width: 45%;
  font-size: .72rem;
  line-height: 1.25;
  text-align: right;
  color: var(--brand-border-strong);
}

.drv-chips {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.chip {
  font-size: .68rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.chip-pending { background: rgba(10, 27, 81, .72); color: var(--brand-border); }
.chip-ok      { background: rgba(43, 169, 79, .18); color: #DDF8E5; }
.chip-fail    { background: rgba(243, 110, 39, .20); color: var(--brand-danger-border); }

.drv-progress { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.drv-progress-bar {
  flex: 1;
  min-width: 0;
  height: 7px;
  background: var(--brand-text-soft);
  border-radius: 999px;
  position: relative;
  overflow: hidden;
}
.drv-progress-ok {
  position: absolute; left: 0; top: 0; height: 100%;
  background: var(--brand-green); transition: width .3s;
}
.drv-progress-err {
  position: absolute; top: 0; height: 100%;
  background: var(--brand-orange); transition: width .3s, left .3s;
}
.drv-progress-label { font-size: .7rem; color: var(--brand-border-strong); white-space: nowrap; font-weight: 700; }

/* ── States ────────────────────────────────────────────────────────── */
.drv-state     { text-align: center; padding: 3rem 1rem; color: var(--brand-muted); }
.drv-state-err { color: var(--brand-orange); }

/* ── Map ───────────────────────────────────────────────────────────── */
.drv-map-section {
  background: var(--brand-surface);
  border-bottom: 1px solid var(--brand-border);
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.map-toggle {
  width: 100%;
  min-height: 42px;
  padding: 9px 14px;
  background: none;
  border: none;
  font-size: .8rem;
  color: var(--brand-navy);
  cursor: pointer;
  font-weight: 800;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
}
.drv-map { height: clamp(180px, 38dvh, 320px); width: 100%; }

/* ── Filter tabs ───────────────────────────────────────────────────── */
.filter-tabs {
  position: sticky;
  top: 83px;
  z-index: 15;
  display: flex;
  background: rgba(255, 255, 255, .96);
  border-bottom: 1px solid var(--brand-border);
  backdrop-filter: blur(10px);
}
.filter-tab {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 9px 4px;
  font-size: .74rem;
  font-weight: 800;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--brand-muted);
  cursor: pointer;
  text-transform: capitalize;
}
.filter-tab.active { color: var(--brand-navy); border-bottom-color: var(--brand-navy); }

/* ── Stop list ─────────────────────────────────────────────────────── */
.stop-list {
  list-style: none;
  margin: 0 auto;
  padding: 10px 10px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
}

.stop-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 10px;
  background: var(--brand-surface);
  border-radius: 14px;
  padding: 11px 12px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, .07);
  cursor: pointer;
  border: 1px solid var(--brand-border);
  border-left: 5px solid transparent;
  -webkit-tap-highlight-color: transparent;
}
.stop-item:active { background: var(--brand-surface-soft); transform: scale(.995); }
.stop-delivered { border-left-color: var(--brand-green); }
.stop-delivered .stop-body { opacity: .68; }
.stop-failed    { border-left-color: var(--brand-orange); }
.stop-failed    .stop-body { opacity: .68; }
.stop-pending   { border-left-color: var(--brand-blue); }

.stop-seq {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--brand-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .76rem;
  font-weight: 800;
  color: var(--brand-text-soft);
  flex-shrink: 0;
}
.stop-delivered .stop-seq { background: var(--brand-success-soft); color: #176D35; }
.stop-failed    .stop-seq { background: var(--brand-danger-soft); color: #B84220; }

.stop-body { min-width: 0; }
.stop-recipient {
  font-weight: 800;
  font-size: .9rem;
  color: var(--brand-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stop-address {
  font-size: .77rem;
  color: var(--brand-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.stop-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }

.stop-status-icon {
  font-size: 1.1rem;
  width: 24px;
  text-align: center;
  color: var(--brand-border-strong);
  font-weight: 800;
}
.stop-delivered .stop-status-icon { color: var(--brand-green); }
.stop-failed    .stop-status-icon { color: var(--brand-orange); }

/* ── Badges ────────────────────────────────────────────────────────── */
.pri-badge  { font-size: .66rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; color: var(--brand-surface); line-height: 1.35; }
.pri-overnight { background: var(--brand-orange); }
.pri-expres    { background: var(--brand-amber); }
.pri-standard  { background: var(--brand-blue); }
.pri-eco       { background: var(--brand-muted-2); }

.flag-badge { font-size: .66rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: var(--brand-warning-soft); color: #8A3F13; line-height: 1.35; }
.cod-badge  { background: var(--brand-blue-soft); color: var(--brand-purple); }

/* ── Bottom sheet ──────────────────────────────────────────────────── */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .58);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: env(safe-area-inset-top, 0px);
}
.sheet {
  width: min(100%, 560px);
  background: var(--brand-surface);
  border-radius: 22px 22px 0 0;
  max-height: min(86dvh, 720px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding-top: 10px;
  box-shadow: 0 -14px 40px rgba(10, 27, 81, .24);
  overflow: hidden;
}
.sheet-handle {
  width: 42px;
  height: 5px;
  background: var(--brand-border-strong);
  border-radius: 999px;
  margin: 0 auto 12px;
  flex-shrink: 0;
}

.sheet-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px 12px;
  overscroll-behavior: contain;
}

.sheet-footer {
  flex-shrink: 0;
  padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--brand-border);
  background: linear-gradient(180deg, rgba(255,255,255,.94), var(--brand-surface));
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.sheet-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sheet-seq   { font-weight: 800; font-size: 1rem; color: var(--brand-text); }
.sheet-close {
  margin-left: auto;
  background: var(--brand-subtle);
  border: 1px solid var(--brand-border);
  font-size: 1rem;
  color: var(--brand-text-soft);
  cursor: pointer;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.sheet-title    { font-size: 1rem; font-weight: 800; color: var(--brand-text); margin-bottom: 12px; }
.sheet-recipient{ font-size: 1.08rem; font-weight: 800; color: var(--brand-text); line-height: 1.3; overflow-wrap: anywhere; }
.sheet-address  { font-size: .9rem; color: var(--brand-text-soft); margin: 5px 0 6px; line-height: 1.35; overflow-wrap: anywhere; }
.sheet-barcode  { font-size: .76rem; color: var(--brand-muted-2); margin-bottom: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }

.sheet-warn,
.sheet-note,
.sheet-cod {
  font-size: .82rem;
  padding: 8px 10px;
  border-radius: 10px;
  margin-bottom: 7px;
  line-height: 1.35;
}
.sheet-warn { background: var(--brand-warning-soft); color: #8A3F13; }
.warn-street { background: var(--brand-warning-soft); color: #8A3F13; }
.sheet-note  { background: var(--brand-success-soft); color: #176D35; }
.sheet-cod   { background: var(--brand-blue-soft); color: var(--brand-purple); font-weight: 800; }

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 50px;
  text-decoration: none;
  background: linear-gradient(135deg, var(--brand-light-blue) 0%, var(--brand-blue) 100%);
  color: var(--brand-surface);
  font-weight: 900;
  padding: 13px 12px;
  border-radius: 14px;
  font-size: .96rem;
  line-height: 1.15;
  text-align: center;
  box-shadow: 0 8px 18px rgba(9, 96, 211, .22);
}

.sheet-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 9px;
}
.action-btn {
  width: 100%;
  min-width: 0;
  min-height: 50px;
  padding: 12px 8px;
  border: none;
  border-radius: 14px;
  font-size: .92rem;
  line-height: 1.15;
  font-weight: 900;
  cursor: pointer;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  -webkit-tap-highlight-color: transparent;
}
.action-btn:active { filter: brightness(.92); transform: translateY(1px); }
.action-btn:disabled { opacity: .45; cursor: not-allowed; }
.action-ok   { background: linear-gradient(135deg, var(--brand-green), #228A43); color: var(--brand-surface); box-shadow: 0 8px 18px rgba(43, 169, 79, .20); }
.action-fail { background: linear-gradient(135deg, var(--brand-orange), #D6541C); color: var(--brand-surface); box-shadow: 0 8px 18px rgba(243, 110, 39, .18); }

.sheet-done      { font-size: .88rem; font-weight: 800; padding: 10px 12px; border-radius: 10px; line-height: 1.35; }
.sheet-done-ok   { background: var(--brand-success-soft); color: #176D35; }
.sheet-done-fail { background: var(--brand-danger-soft); color: #B84220; }
.sheet-done-note { font-size: .78rem; color: var(--brand-muted); padding: 0 2px; line-height: 1.35; }

.undo-btn {
  width: 100%;
  min-height: 46px;
  padding: 11px;
  background: var(--brand-surface-soft);
  border: 1px solid var(--brand-border-strong);
  border-radius: 12px;
  font-size: .86rem;
  font-weight: 800;
  color: var(--brand-text-soft);
  cursor: pointer;
}

/* ── Fail picker sheet ─────────────────────────────────────────────── */
.reason-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.reason-btn {
  min-width: 0;
  min-height: 46px;
  padding: 10px 8px;
  border: 2px solid var(--brand-border);
  border-radius: 12px;
  background: var(--brand-surface-soft);
  cursor: pointer;
  font-size: .8rem;
  font-weight: 800;
  color: var(--brand-text-soft);
  line-height: 1.2;
  transition: border-color .12s, background .12s;
  -webkit-tap-highlight-color: transparent;
}
.reason-btn.selected {
  border-color: var(--brand-orange);
  background: var(--brand-danger-soft);
  color: #B84220;
}
.fail-note {
  width: 100%;
  border: 1px solid var(--brand-border-strong);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: .9rem;
  margin-bottom: 4px;
  resize: vertical;
  min-height: 72px;
  box-sizing: border-box;
  font-family: var(--font-body);
}

/* ── Small phones ──────────────────────────────────────────────────── */
@media (max-width: 420px) {
  .drv-header { padding-inline: 12px; }
  .drv-date { max-width: 42%; font-size: .68rem; }
  .filter-tabs { top: 86px; }
  .stop-list { padding-inline: 8px; }
  .stop-item { grid-template-columns: 30px minmax(0, 1fr) 20px; padding: 10px; gap: 8px; }
  .sheet-scroll { padding-inline: 14px; }
  .sheet-footer { padding-inline: 12px; }
}

@media (max-width: 340px) {
  .drv-header-top { flex-direction: column; gap: 4px; }
  .drv-date { max-width: none; text-align: left; }
  .filter-tabs { top: 115px; }
  .sheet-actions,
  .reason-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) {
  .driver-route { padding-bottom: 2rem; }
  .drv-header { border-radius: 0 0 20px 20px; }
  .filter-tabs { top: 91px; }
  .sheet-backdrop { align-items: center; padding: 24px; }
  .sheet { border-radius: 24px; max-height: min(82dvh, 760px); }
}

/* ── Transitions ───────────────────────────────────────────────────── */
.sheet-enter-active, .sheet-leave-active { transition: opacity .18s; }
.sheet-enter-from,  .sheet-leave-to     { opacity: 0; }
.sheet-enter-active .sheet,
.sheet-leave-active .sheet  { transition: transform .22s cubic-bezier(.32,.72,0,1); }
.sheet-enter-from   .sheet  { transform: translateY(100%); }
.sheet-leave-to     .sheet  { transform: translateY(100%); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
  }
}
</style>
