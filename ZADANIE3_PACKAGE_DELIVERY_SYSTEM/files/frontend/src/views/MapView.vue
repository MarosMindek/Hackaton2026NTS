<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import 'ol/ol.css'

import Map from 'ol/Map.js'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import VectorLayer from 'ol/layer/Vector.js'
import OSM from 'ol/source/OSM.js'
import VectorSource from 'ol/source/Vector.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import { fromLonLat } from 'ol/proj.js'
import Style from 'ol/style/Style.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Text from 'ol/style/Text.js'
import Overlay from 'ol/Overlay.js'
import LineString from 'ol/geom/LineString.js'

import { useDeliveryStore, type AssignmentItem } from '@/stores/delivery'

const store = useDeliveryStore()

const mapEl       = ref<HTMLElement | null>(null)
const popupEl     = ref<HTMLElement | null>(null)
const sidebarEl   = ref<HTMLElement | null>(null)
const selZone     = ref('')
const showUnassigned  = ref(true)
const showUnresolved  = ref(false)
const showDistricts   = ref(true)
const districtOpacity = ref(8)
const showRoutes      = ref(false)
const routesLoading   = ref(false)
const routesProgress  = ref({ done: 0, total: 0 })
const popupData       = ref<Record<string, unknown> | null>(null)
const mapReady        = ref(false)
const selectedStopId  = ref<number | null>(null)

interface RouteInfo {
  driver_id: string
  driver_name: string
  zone: string
  packages: number
  distance_km: number
  drive_duration_min: number
  est_delivery_min: number
  source: string
}
const routeInfo    = ref<RouteInfo | null>(null)
const routeLoading = ref(false)

const sidebarStops = computed<AssignmentItem[]>(() => {
  if (!store.selectedDriverId) return []
  return store.assignments
    .filter(a => a.driver_id === store.selectedDriverId)
    .sort((a, b) => a.sequence_number - b.sequence_number)
})

const streetLevelCount = computed(() => {
  if (!routeInfo.value) return 0
  return store.assignments.filter(
    (a) => a.driver_id === routeInfo.value!.driver_id &&
      (a.geocode_status === 'street' || a.geocode_status === 'out_of_district')
  ).length
})

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

const zones = computed(() => {
  const s = store.stats
  if (!s) return [] as string[]
  return [...new Set(s.zones.map((z) => z.zone))].sort()
})

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

const PRIORITY_COLORS: Record<string, string> = {
  Overnight: '#F36E27',
  Expres: '#F99D20',
  Štandard: '#0647C9',
  Ekonomický: '#8EA0B8',
}
function priorityColor(p: string) { return PRIORITY_COLORS[p] ?? '#8EA0B8' }

const geojsonFormat = new GeoJSON({ featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' })

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function districtStyle(feature: Feature): Style {
  const nm4 = String((feature.getProperties() as Record<string, unknown>)['NM4'] ?? '')
  const zone = nm4.startsWith('Košice-') ? nm4.slice(7) : nm4
  const hex = ZONE_COLORS[zone] ?? '#8EA0B8'
  const [r, g, b] = hexToRgb(hex)
  const fillAlpha = districtOpacity.value / 100
  const strokeAlpha = Math.min(0.55 + fillAlpha * 1.5, 0.95)
  return new Style({
    fill: new Fill({ color: `rgba(${r},${g},${b},${fillAlpha})` }),
    stroke: new Stroke({ color: `rgba(${r},${g},${b},${strokeAlpha.toFixed(2)})`, width: fillAlpha < 0.05 ? 2.5 : 2 }),
    text: new Text({
      text: zone,
      font: 'bold 11px Graphik, Arial, sans-serif',
      overflow: true,
      fill: new Fill({ color: fillAlpha > 0.08 ? '#0A1B51' : `rgba(${r},${g},${b},0.9)` }),
      stroke: new Stroke({ color: 'rgba(255,255,255,0.9)', width: 3 }),
      backgroundFill: fillAlpha > 0.08 ? new Fill({ color: 'rgba(255,255,255,0.55)' }) : undefined,
      padding: [1, 3, 1, 3],
    }),
  })
}

function priorityRadius(priority: string): number {
  if (priority === 'Overnight') return 9
  if (priority === 'Expres')    return 8
  if (priority === 'Štandard')  return 7
  return 6
}

function geocodeStyle(color: string, status: string | null, radius = 7): Style[] {
  // Fallback: tiny grey dot — zone centroid only, no real geocoding
  if (status === 'fallback') {
    return [new Style({
      image: new CircleStyle({ radius: 4, fill: new Fill({ color: 'rgba(156,163,175,0.45)' }), stroke: new Stroke({ color: 'rgba(255,255,255,0.6)', width: 1 }) }),
    })]
  }

  // White halo behind every real dot — lifts it above the district fill
  const halo = new Style({ image: new CircleStyle({ radius: radius + 4, fill: new Fill({ color: 'rgba(255,255,255,0.55)' }) }) })

  // Out-of-district: orange outer ring + zone-colour inner dot
  if (status === 'out_of_district') {
    return [
      halo,
      new Style({ image: new CircleStyle({ radius: radius + 3, fill: new Fill({ color: '#F36E27' }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }) }),
      new Style({ image: new CircleStyle({ radius: radius - 1, fill: new Fill({ color }) }) }),
    ]
  }

  // Street-level: ring (white fill + coloured stroke) — no house number, driver finds on arrival
  if (status === 'street') {
    return [
      halo,
      new Style({ image: new CircleStyle({ radius, fill: new Fill({ color: '#fff' }), stroke: new Stroke({ color, width: 3 }) }) }),
    ]
  }

  // Full address — solid dot
  return [
    halo,
    new Style({ image: new CircleStyle({ radius, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 2 }) }) }),
  ]
}

function featureStyle(feature: Feature): Style | Style[] {
  const props     = feature.getProperties() as Record<string, unknown>
  const color     = (props['color'] as string) ?? '#8EA0B8'
  const zone      = (props['zone'] as string) ?? ''
  const geoStatus = (props['geocode_status'] as string | null) ?? null
  const priority  = (props['priority'] as string) ?? ''
  if (selZone.value && zone !== selZone.value) {
    return new Style({ image: new CircleStyle({ radius: 3, fill: new Fill({ color: color + '44' }) }) })
  }
  return geocodeStyle(color, geoStatus, priorityRadius(priority))
}

function stopStyle(feature: Feature): Style {
  const props = feature.getProperties() as Record<string, unknown>
  const seq = String(props['sequence_number'] ?? '')
  const prio = String(props['priority'] ?? '')
  const isSelected = props['package_id'] === selectedStopId.value
  const color = priorityColor(prio)
  return new Style({
    image: new CircleStyle({
      radius: isSelected ? 14 : 11,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#fff', width: isSelected ? 3 : 2 }),
    }),
    text: new Text({
      text: seq,
      font: `bold ${isSelected ? 10 : 9}px Graphik, Arial, sans-serif`,
      fill: new Fill({ color: '#fff' }),
    }),
  })
}

let map: Map | null = null
let assignedSource: VectorSource | null = null
let unassignedSource: VectorSource | null = null
let unresolvedSource: VectorSource | null = null
let routesSource: VectorSource | null = null
let selectedRouteSource: VectorSource | null = null
let selectedStopsSource: VectorSource | null = null
let districtsSource: VectorSource | null = null
let assignedLayer: VectorLayer<VectorSource> | null = null
let unassignedLayer: VectorLayer<VectorSource> | null = null
let unresolvedLayer: VectorLayer<VectorSource> | null = null
let routesLayer: VectorLayer<VectorSource> | null = null
let selectedRouteLayer: VectorLayer<VectorSource> | null = null
let selectedStopsLayer: VectorLayer<VectorSource> | null = null
let districtsLayer: VectorLayer<VectorSource> | null = null
let popup: Overlay | null = null

function rebuildAssignedLayer() {
  assignedSource?.clear()
  const gj = store.geojson
  if (!gj) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features = geojsonFormat.readFeatures(gj as any)
  assignedSource?.addFeatures(features)
}

function rebuildUnassignedLayer() {
  unassignedSource?.clear()
  const gj = store.unassignedGeojson
  if (!gj) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features = geojsonFormat.readFeatures(gj as any)
  unassignedSource?.addFeatures(features)
}

function rebuildSelectedStops() {
  selectedStopsSource?.clear()
  sidebarStops.value.forEach(stop => {
    const f = new Feature({
      geometry: new Point(fromLonLat([stop.lon, stop.lat])),
      package_id: stop.package_id,
      sequence_number: stop.sequence_number,
      priority: stop.priority,
      is_stop_marker: true,
    })
    selectedStopsSource?.addFeature(f)
  })
}

function focusStop(stop: AssignmentItem) {
  selectedStopId.value = stop.package_id
  const coord = fromLonLat([stop.lon, stop.lat])
  const view = map?.getView()
  if (view) {
    const zoom = Math.max(view.getZoom() ?? 15, 15)
    view.animate({ center: coord, zoom, duration: 400 })
  }
  selectedStopsLayer?.changed()
  popupData.value = {
    package_id:           stop.package_id,
    barcode:              stop.barcode,
    recipient_name:       stop.recipient_name,
    address:              stop.address,
    priority:             stop.priority,
    weight_kg:            stop.weight_kg,
    fragile:              stop.fragile,
    geocode_status:       stop.geocode_status,
    special_instructions: stop.special_instructions,
    driver_name:          routeInfo.value?.driver_name,
    zone:                 routeInfo.value?.zone,
    sequence_number:      stop.sequence_number,
  }
  popup?.setPosition(coord)
}

watch(() => store.geojson, rebuildAssignedLayer)
watch(() => store.unassignedGeojson, rebuildUnassignedLayer)
watch(selZone, () => { assignedLayer?.changed(); clearRoutes() })
watch(showUnassigned, (v) => unassignedLayer?.setVisible(v))
watch(showDistricts, (v) => districtsLayer?.setVisible(v))
watch(districtOpacity, () => districtsLayer?.changed())
watch(showRoutes, (v) => routesLayer?.setVisible(v))
watch(showUnresolved, (v) => {
  unresolvedLayer?.setVisible(v)
  if (v && unresolvedSource && unresolvedSource.getFeatures().length === 0) {
    loadUnresolvedLayer()
  }
})

watch([() => store.selectedDriverId, mapReady], ([id, ready]) => {
  if (!ready) return
  if (id) loadSingleDriverRoute(id)
  else clearSelectedRoute()
})

watch(sidebarStops, () => {
  if (routeInfo.value) rebuildSelectedStops()
})

watch(routeInfo, () => {
  setTimeout(() => map?.updateSize(), 320)
})

watch(selectedStopId, (id) => {
  selectedStopsLayer?.changed()
  if (id === null) return
  nextTick(() => {
    sidebarEl.value?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
})

onMounted(async () => {
  if (!mapEl.value || !popupEl.value) return

  assignedSource      = new VectorSource()
  unassignedSource    = new VectorSource()
  unresolvedSource    = new VectorSource()
  routesSource        = new VectorSource()
  selectedRouteSource = new VectorSource()
  selectedStopsSource = new VectorSource()
  districtsSource     = new VectorSource({
    url:    '/api/zones/geojson',
    format: new GeoJSON({ featureProjection: 'EPSG:3857' }),
  })

  assignedLayer = new VectorLayer({
    source: assignedSource,
    style: (f) => featureStyle(f as Feature),
    zIndex: 2,
  })

  unassignedLayer = new VectorLayer({
    source: unassignedSource,
    style: (f) => {
      const props = (f as Feature).getProperties() as Record<string, unknown>
      const geoStatus = (props['geocode_status'] as string | null) ?? null
      const priority  = (props['priority'] as string) ?? ''
      return geocodeStyle('#F36E27', geoStatus, priorityRadius(priority))
    },
    zIndex: 3,
  })

  unresolvedLayer = new VectorLayer({
    source: unresolvedSource,
    style: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#F36E27' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }),
    zIndex: 3,
    visible: false,
  })

  routesLayer = new VectorLayer({
    source: routesSource,
    style: (f) => {
      const props = (f as Feature).getProperties() as Record<string, unknown>
      const color = (props['zone'] ? ZONE_COLORS[props['zone'] as string] : null) ?? '#0647C9'
      return new Style({ stroke: new Stroke({ color, width: 3, lineDash: [6, 4] }) })
    },
    zIndex: 1,
    visible: false,
  })

  selectedRouteLayer = new VectorLayer({
    source: selectedRouteSource,
    style: new Style({ stroke: new Stroke({ color: '#0999E8', width: 5 }) }),
    zIndex: 4,
  })

  selectedStopsLayer = new VectorLayer({
    source: selectedStopsSource,
    style: (f) => stopStyle(f as Feature),
    zIndex: 6,
  })

  districtsLayer = new VectorLayer({
    source: districtsSource,
    style: (f) => districtStyle(f as Feature),
    zIndex: 0,
  })

  popup = new Overlay({ element: popupEl.value, positioning: 'bottom-center', offset: [0, -10], stopEvent: false })

  map = new Map({
    target: mapEl.value,
    layers: [
      new TileLayer({ source: new OSM() }),
      districtsLayer,
      routesLayer,
      assignedLayer,
      unassignedLayer,
      unresolvedLayer,
      selectedRouteLayer,
      selectedStopsLayer,
    ],
    overlays: [popup],
    view: new View({ center: fromLonLat([21.26, 48.72]), zoom: 12 }),
  })

  if (store.geojson)           rebuildAssignedLayer()
  if (store.unassignedGeojson) rebuildUnassignedLayer()

  if (!store.geojson && store.stats && store.stats.assigned > 0) {
    await store.fetchGeojson()
  }

  map.on('click', (e) => {
    let hit = false
    map!.forEachFeatureAtPixel(e.pixel, (f) => {
      if (hit) return
      const props = (f as Feature).getProperties() as Record<string, unknown>
      if (!props['package_id']) return
      hit = true

      // numbered stop marker — highlight in sidebar + show popup
      if (props['is_stop_marker']) {
        const pkgId = props['package_id'] as number
        selectedStopId.value = pkgId
        selectedStopsLayer?.changed()
        const stop = sidebarStops.value.find(s => s.package_id === pkgId)
        if (stop) {
          popupData.value = {
            package_id:           stop.package_id,
            barcode:              stop.barcode,
            recipient_name:       stop.recipient_name,
            address:              stop.address,
            priority:             stop.priority,
            weight_kg:            stop.weight_kg,
            fragile:              stop.fragile,
            geocode_status:       stop.geocode_status,
            special_instructions: stop.special_instructions,
            driver_name:          routeInfo.value?.driver_name,
            zone:                 routeInfo.value?.zone,
            sequence_number:      stop.sequence_number,
          }
          popup!.setPosition(e.coordinate)
        }
        return
      }

      // regular package dot — show popup and select driver route
      popupData.value = props
      popup!.setPosition(e.coordinate)

      const driverId = props['driver_id'] as string | undefined
      if (driverId && driverId !== store.selectedDriverId) {
        store.selectedDriverId = driverId
        loadSingleDriverRoute(driverId)
      }
    })
    if (!hit) {
      popupData.value = null
      popup!.setPosition(undefined)
    }
  })

  map.on('pointermove', (e) => {
    if (mapEl.value) {
      mapEl.value.style.cursor = map!.hasFeatureAtPixel(e.pixel) ? 'pointer' : ''
    }
  })

  mapReady.value = true
})

onUnmounted(() => {
  map?.setTarget(undefined)
  map = assignedLayer = unassignedLayer = unresolvedLayer = routesLayer =
    selectedRouteLayer = selectedStopsLayer = districtsLayer = null
})

async function loadMap() {
  await store.fetchGeojson()
}

async function loadUnresolvedLayer() {
  try {
    const res = await fetch('/api/packages/unresolved/geojson')
    const gj  = await res.json()
    unresolvedSource?.addFeatures(geojsonFormat.readFeatures(gj))
  } catch { /* ignore */ }
}

function clearRoutes() {
  routesSource?.clear()
  showRoutes.value = false
  routesProgress.value = { done: 0, total: 0 }
}

function clearSelectedRoute() {
  selectedRouteSource?.clear()
  selectedStopsSource?.clear()
  selectedStopId.value = null
  routeInfo.value = null
  store.selectedDriverId = null
  popupData.value = null
  popup?.setPosition(undefined)
}

async function loadSingleDriverRoute(driverId: string) {
  selectedRouteSource?.clear()
  selectedStopsSource?.clear()
  selectedStopId.value = null
  routeInfo.value = null
  routeLoading.value = true
  try {
    const res  = await fetch(`/api/routes/${driverId}`)
    const feat = await res.json()
    if (feat?.geometry?.coordinates) {
      const coords = (feat.geometry.coordinates as [number, number][]).map((c) => fromLonLat(c))
      const f = new Feature({ geometry: new LineString(coords) })
      selectedRouteSource?.addFeature(f)

      const p = feat.properties ?? {}
      routeInfo.value = {
        driver_id:          driverId,
        driver_name:        p.driver_name ?? driverId,
        zone:               p.zone ?? '',
        packages:           p.packages ?? 0,
        distance_km:        p.distance_km ?? 0,
        drive_duration_min: p.drive_duration_min ?? 0,
        est_delivery_min:   p.est_delivery_min ?? 0,
        source:             p.source ?? 'unknown',
      }

      // OSRM reordered the stops — refresh to get updated sequence numbers
      if (p.reordered) {
        await store.fetchAssignments()
      }

      rebuildSelectedStops()

      const extent = selectedRouteSource!.getExtent()
      map?.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600 })
    }
  } catch { /* ignore */ }
  routeLoading.value = false
}

async function loadRoutes() {
  if (!store.stats?.drivers) return
  const drivers = store.stats.drivers.filter(
    (d) => d.assigned_packages > 0 && (!selZone.value || d.zone_mestska_cast === selZone.value)
  )
  routesSource?.clear()
  routesProgress.value = { done: 0, total: drivers.length }
  showRoutes.value = true
  routesLayer?.setVisible(true)
  routesLoading.value = true

  for (const drv of drivers) {
    try {
      const res  = await fetch(`/api/routes/${drv.driver_id}`)
      const feat = await res.json()
      if (feat?.geometry?.coordinates) {
        const coords = (feat.geometry.coordinates as [number, number][]).map((c) => fromLonLat(c))
        const f = new Feature({ geometry: new LineString(coords) })
        f.setProperties({ zone: drv.zone_mestska_cast, driver_id: drv.driver_id })
        routesSource?.addFeature(f)
      }
    } catch { /* skip */ }
    routesProgress.value.done++
    await new Promise((r) => setTimeout(r, 120))
  }
  routesLoading.value = false
}
</script>

<template>
  <div class="page">
    <!-- ── Controls bar ── -->
    <div class="controls">
      <select v-model="selZone" class="zone-select">
        <option value="">All zones</option>
        <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
      </select>

      <div class="district-ctrl">
        <label class="toggle">
          <input type="checkbox" v-model="showDistricts" />
          <span>Districts</span>
        </label>
        <template v-if="showDistricts">
          <input
            type="range" min="0" max="80" step="5"
            v-model.number="districtOpacity"
            class="opacity-slider"
            title="District fill opacity"
            :style="{ '--pct': (districtOpacity / 40 * 100) + '%' }"
          />
          <span class="opacity-val">{{ districtOpacity === 0 ? 'outline' : districtOpacity + '%' }}</span>
        </template>
      </div>

      <label class="toggle">
        <input type="checkbox" v-model="showUnassigned" />
        <span>Unassigned</span>
      </label>

      <label class="toggle toggle-unresolved">
        <input type="checkbox" v-model="showUnresolved" />
        <span>Unresolved</span>
        <span v-if="store.stats?.unresolved" class="unresolved-ct">{{ store.stats.unresolved }}</span>
      </label>

      <button class="btn-load" @click="loadMap" :disabled="!store.stats">Refresh map</button>

      <button class="btn-routes" :disabled="!store.stats || routesLoading" @click="loadRoutes">
        <span v-if="routesLoading">{{ routesProgress.done }}/{{ routesProgress.total }} routes…</span>
        <span v-else>Show all routes</span>
      </button>

      <button v-if="routesProgress.total > 0" class="btn-routes-clear" @click="clearRoutes">
        Clear routes
      </button>

      <div class="map-counts" v-if="store.stats">
        <span class="count-chip assigned">✓ {{ store.stats.assigned }} assigned</span>
        <span class="count-chip unassigned" v-if="store.stats.unassigned > 0">
          ✗ {{ store.stats.unassigned }} unassigned
        </span>
      </div>
    </div>

    <!-- ── Content: map + sidebar side by side ── -->
    <div class="content-area">
      <!-- Map -->
      <div class="map-area">
        <div ref="mapEl" class="map"></div>

        <!-- Popup -->
        <div ref="popupEl" class="popup" v-show="popupData">
          <div v-if="popupData" class="popup-inner">
            <div class="popup-close" @click="popupData = null; popup?.setPosition(undefined)">✕</div>
            <div class="popup-top-row">
              <div class="popup-barcode">{{ popupData['barcode'] }}</div>
              <div v-if="popupData['sequence_number']" class="popup-stop-badge">
                #{{ popupData['sequence_number'] }}
              </div>
            </div>
            <div class="popup-name">{{ popupData['recipient_name'] }}</div>
            <div class="popup-addr">{{ popupData['address'] }}</div>
            <div class="popup-row">
              <span class="priority-badge" :style="{ background: priorityColor(String(popupData['priority'])) }">
                {{ popupData['priority'] }}
              </span>
              <span class="popup-weight">{{ popupData['weight_kg'] }} kg</span>
              <span v-if="popupData['fragile']" class="popup-fragile">⚠ Fragile</span>
            </div>
            <div v-if="popupData['geocode_status'] === 'out_of_district'" class="popup-geocode-mismatch">
              ⚠ Address outside expected district
            </div>
            <div v-else-if="popupData['geocode_status'] === 'street'" class="popup-geocode-warn">
              ⚠ Street-level — find house number on arrival
            </div>
            <div v-else-if="!popupData['geocode_status'] || popupData['geocode_status'] === null" class="popup-geocode-approx">
              ~ Approximate location
            </div>
            <div class="popup-driver" v-if="popupData['driver_name']">
              🚗 {{ popupData['driver_name'] }} — {{ popupData['zone'] ?? popupData['city_district'] }}
            </div>
            <div class="popup-driver unassigned-label" v-else>
              ✗ Unassigned
            </div>
            <div v-if="popupData['special_instructions']" class="popup-instructions">
              📋 {{ popupData['special_instructions'] }}
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="legend">
          <div class="legend-title">Zones</div>
          <div v-for="(color, zone) in ZONE_COLORS" :key="zone" class="legend-item">
            <span class="legend-dot" :style="{ background: color }"></span>
            <span>{{ zone }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#F36E27"></span>
            <span>Unassigned</span>
          </div>
          <div v-if="showUnresolved" class="legend-item">
            <span class="legend-dot" style="background:#F36E27"></span>
            <span>Unresolved</span>
          </div>
          <div v-if="showRoutes" class="legend-item">
            <span class="legend-line"></span>
            <span>Route</span>
          </div>

          <!-- Geocode quality key -->
          <div class="legend-sep"></div>
          <div class="legend-title">Geocode quality</div>
          <div class="legend-item">
            <span class="legend-q legend-q-address"></span>
            <span>Full address</span>
          </div>
          <div class="legend-item">
            <span class="legend-q legend-q-street"></span>
            <span>Street only</span>
          </div>
          <div class="legend-item">
            <span class="legend-q legend-q-mismatch"></span>
            <span>Wrong district</span>
          </div>
          <div class="legend-item">
            <span class="legend-q legend-q-fallback"></span>
            <span>No geocode</span>
          </div>

          <!-- Priority size key (only when no driver selected) -->
          <template v-if="!routeInfo">
            <div class="legend-sep"></div>
            <div class="legend-title">Priority (size)</div>
            <div v-for="(color, label) in PRIORITY_COLORS" :key="label" class="legend-item">
              <span class="legend-dot" :style="{ background: color }"></span>
              <span>{{ label }}</span>
            </div>
          </template>

          <div v-if="routeInfo" class="legend-priority">
            <div class="legend-sep"></div>
            <div v-for="(color, label) in PRIORITY_COLORS" :key="label" class="legend-item">
              <span class="legend-dot" :style="{ background: color }"></span>
              <span>{{ label }}</span>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!store.stats || store.stats.total_packages === 0" class="map-overlay">
          <div>🗺️</div>
          <p>Run optimization first, then come back to see packages on the map.</p>
        </div>
      </div>

      <!-- ── Route sidebar ── -->
      <div class="route-sidebar" :class="{ open: !!routeInfo || routeLoading }">
        <div class="sidebar-inner">
          <!-- Loading -->
          <div class="sidebar-loading" v-if="routeLoading && !routeInfo">
            <span class="spinner-sm"></span>
            Loading route…
          </div>

          <template v-if="routeInfo">
            <!-- Header -->
            <div class="sidebar-header">
              <div class="sidebar-header-top">
                <div>
                  <div class="sidebar-driver-name">{{ routeInfo.driver_name }}</div>
                  <div class="sidebar-driver-zone">{{ routeInfo.zone }}</div>
                </div>
                <button class="sidebar-close" @click="clearSelectedRoute" title="Close">✕</button>
              </div>
              <div class="sidebar-stats">
                <span class="stat-chip">📦 {{ routeInfo.packages }} stops</span>
                <span class="stat-chip" v-if="routeInfo.distance_km > 0">
                  📍 {{ routeInfo.distance_km }} km
                </span>
                <span class="stat-chip">
                  🚗 {{ formatMin(routeInfo.drive_duration_min) }}
                </span>
                <span class="stat-chip highlight">
                  ⏱ {{ formatMin(routeInfo.est_delivery_min) }} total
                </span>
              </div>
              <div class="sidebar-flags" v-if="streetLevelCount > 0 || routeInfo.source === 'straight'">
                <span v-if="streetLevelCount > 0" class="stat-chip warn">
                  ⚠ {{ streetLevelCount }} approx. addr.
                </span>
                <span v-if="routeInfo.source === 'straight'" class="stat-chip warn">
                  ⚠ straight-line
                </span>
              </div>
            </div>

            <!-- Priority legend for numbered markers -->
            <div class="sidebar-legend">
              <span v-for="(color, label) in PRIORITY_COLORS" :key="label" class="pl-item">
                <span class="pl-dot" :style="{ background: color }"></span>{{ label }}
              </span>
            </div>

            <!-- Stop list -->
            <div class="sidebar-stops" ref="sidebarEl">
              <div
                v-for="stop in sidebarStops"
                :key="stop.sequence_number"
                class="stop-row"
                :class="{ active: selectedStopId === stop.package_id }"
                :data-id="stop.package_id"
                @click="focusStop(stop)"
              >
                <div class="stop-seq" :style="{ background: priorityColor(stop.priority) }">
                  {{ stop.sequence_number }}
                </div>
                <div class="stop-info">
                  <div class="stop-name">{{ stop.recipient_name }}</div>
                  <div class="stop-addr">{{ stop.address }}</div>
                  <div class="stop-meta">
                    <span class="stop-weight">{{ stop.weight_kg }} kg</span>
                    <span v-if="stop.priority === 'Overnight' || stop.priority === 'Expres'"
                          class="stop-flag priority-flag"
                          :style="{ background: priorityColor(stop.priority) }">
                      {{ stop.priority }}
                    </span>
                    <span v-if="stop.fragile" class="stop-flag fragile-flag">Fragile</span>
                    <span v-if="stop.geocode_status === 'out_of_district'" class="stop-flag mismatch-flag">! district</span>
                    <span v-if="stop.geocode_status === 'street'" class="stop-flag street-flag">street</span>
                    <span v-if="stop.special_instructions" class="stop-flag special-flag" :title="stop.special_instructions">📋</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; }

/* ── Controls ── */
.controls {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 16px; background: var(--brand-surface); border-bottom: 1px solid var(--brand-border);
  flex-shrink: 0;
}

.zone-select {
  padding: 6px 12px; border-radius: 7px; border: 1px solid var(--brand-border);
  font-size: 0.85rem; background: var(--brand-surface); color: var(--brand-text); cursor: pointer;
}

.toggle { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--brand-text-soft); cursor: pointer; }
.toggle input { cursor: pointer; }
.toggle-unresolved { color: #B84220; }
.unresolved-ct {
  background: var(--brand-warning-soft); color: #B84220; border: 1px solid var(--brand-warning-border);
  font-size: 0.7rem; font-weight: 700; padding: 1px 6px; border-radius: 99px;
}

.district-ctrl {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 10px; border-radius: 8px; border: 1px solid var(--brand-border); background: var(--brand-surface-soft);
}
.opacity-slider {
  -webkit-appearance: none; appearance: none;
  width: 80px; height: 4px; border-radius: 2px;
  background: linear-gradient(to right, var(--brand-blue) 0%, var(--brand-blue) calc(var(--pct, 37.5%)), var(--brand-border) calc(var(--pct, 37.5%)));
  outline: none; cursor: pointer;
}
.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--brand-blue); border: 2px solid var(--brand-surface); box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: pointer;
}
.opacity-slider::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--brand-blue); border: 2px solid var(--brand-surface); box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: pointer;
}
.opacity-val { font-size: 0.72rem; color: var(--brand-blue); font-weight: 700; min-width: 40px; }

.btn-load {
  padding: 6px 14px; border-radius: 7px; border: 1px solid var(--brand-border);
  background: var(--brand-surface-soft); color: var(--brand-text-soft); font-size: 0.85rem; cursor: pointer;
}
.btn-load:hover:not(:disabled) { background: var(--brand-subtle); }
.btn-load:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-routes {
  padding: 6px 14px; border-radius: 7px; border: 1px solid var(--brand-border-strong);
  background: var(--brand-blue-soft); color: var(--brand-blue); font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.btn-routes:hover:not(:disabled) { background: var(--brand-blue-soft-strong); }
.btn-routes:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-routes-clear {
  padding: 6px 12px; border-radius: 7px; border: 1px solid var(--brand-danger-border);
  background: var(--brand-danger-soft); color: var(--brand-orange); font-size: 0.82rem; cursor: pointer;
}
.btn-routes-clear:hover { background: var(--brand-danger-border); }

.map-counts { display: flex; gap: 8px; margin-left: auto; }
.count-chip { font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
.count-chip.assigned   { background: var(--brand-success-soft); color: var(--brand-green); }
.count-chip.unassigned { background: var(--brand-danger-soft); color: var(--brand-orange); }

/* ── Content area ── */
.content-area { flex: 1; display: flex; flex-direction: row; min-height: 0; overflow: hidden; }

/* ── Map ── */
.map-area { flex: 1; position: relative; min-height: 0; min-width: 0; }
.map { width: 100%; height: 100%; }

/* ── Popup ── */
.popup {
  position: absolute; background: var(--brand-surface); border: 1px solid var(--brand-border);
  border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  min-width: 240px; max-width: 300px; pointer-events: all; z-index: 200;
  transform: translate(-50%, -100%); margin-top: -10px;
}
.popup-inner { padding: 14px 16px; }
.popup-close {
  position: absolute; top: 8px; right: 10px; cursor: pointer;
  color: var(--brand-muted-2); font-size: 0.8rem;
}
.popup-close:hover { color: var(--brand-text-soft); }
.popup-top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.popup-barcode { font-family: monospace; font-size: 0.75rem; color: var(--brand-blue); }
.popup-stop-badge {
  font-size: 0.7rem; font-weight: 700; padding: 1px 7px; border-radius: 99px;
  background: var(--brand-cyan); color: var(--brand-surface); flex-shrink: 0;
}
.popup-name  { font-weight: 700; font-size: 0.92rem; color: var(--brand-text); margin-bottom: 3px; }
.popup-addr  { font-size: 0.78rem; color: var(--brand-muted); margin-bottom: 8px; line-height: 1.4; }
.popup-row   { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.priority-badge { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; color: var(--brand-surface); }
.popup-weight  { font-size: 0.8rem; color: var(--brand-text-soft); }
.popup-fragile { font-size: 0.78rem; color: var(--brand-amber); }
.popup-driver       { font-size: 0.8rem; color: var(--brand-text-soft); margin-top: 4px; }
.unassigned-label   { color: var(--brand-orange); font-weight: 600; }
.popup-instructions {
  font-size: 0.75rem; color: var(--brand-text-soft); background: var(--brand-surface-soft);
  border: 1px solid var(--brand-border); border-radius: 5px; padding: 4px 8px;
  margin-top: 7px; line-height: 1.4; white-space: pre-wrap; word-break: break-word;
}
.popup-geocode-mismatch {
  font-size: 0.75rem; color: #B84220; background: var(--brand-danger-soft);
  border: 1px solid var(--brand-danger-border); border-radius: 5px; padding: 3px 8px; margin-bottom: 7px; font-weight: 600;
}
.popup-geocode-warn {
  font-size: 0.75rem; color: #8A3F13; background: var(--brand-warning-soft);
  border: 1px solid var(--brand-warning-border); border-radius: 5px; padding: 3px 8px; margin-bottom: 7px; font-weight: 600;
}
.popup-geocode-approx {
  font-size: 0.75rem; color: var(--brand-muted); background: var(--brand-subtle);
  border: 1px solid var(--brand-border); border-radius: 5px; padding: 3px 8px; margin-bottom: 7px;
}

/* ── Legend ── */
.legend {
  position: absolute; top: 12px; right: 12px; z-index: 100;
  background: rgba(255,255,255,0.95); border: 1px solid var(--brand-border);
  border-radius: 10px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-height: calc(100% - 24px); overflow-y: auto;
}
.legend-title { font-size: 0.72rem; font-weight: 700; color: var(--brand-text-soft); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
.legend-item  { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 0.75rem; color: var(--brand-text-soft); }
.legend-dot   { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.legend-line  { width: 18px; height: 3px; background: var(--brand-blue); border-radius: 2px; flex-shrink: 0; border-top: 1px dashed var(--brand-blue); }
.legend-sep   { height: 1px; background: var(--brand-border); margin: 6px 0; }

/* Geocode quality symbols in the legend */
.legend-q {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; display: inline-block;
}
.legend-q-address  { background: var(--brand-blue); box-shadow: 0 0 0 2px var(--brand-surface), 0 0 0 4px rgba(6,71,201,0.25); }
.legend-q-street   { background: var(--brand-surface); border: 3px solid var(--brand-blue); }
.legend-q-mismatch { background: var(--brand-orange); box-shadow: 0 0 0 2px var(--brand-surface), 0 0 0 4px rgba(243,110,39,0.30); }
.legend-q-fallback { background: rgba(156,163,175,0.45); border: 1px solid rgba(255,255,255,0.6); }

/* ── Empty overlay ── */
.map-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: rgba(244,248,253,0.88); font-size: 1rem; color: var(--brand-muted); pointer-events: none;
}
.map-overlay div { font-size: 2.5rem; }

/* ── Route sidebar ── */
.route-sidebar {
  width: 0;
  flex-shrink: 0;
  transition: width 0.3s ease;
  overflow: hidden;
}
.route-sidebar.open { width: 340px; }

.sidebar-inner {
  width: 340px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--brand-surface);
  border-left: 1px solid var(--brand-border);
  overflow: hidden;
}

.sidebar-loading {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px; color: var(--brand-blue); font-size: 0.85rem;
}

.sidebar-header {
  padding: 14px 16px; border-bottom: 1px solid var(--brand-border);
  flex-shrink: 0; background: var(--brand-cyan-soft);
}
.sidebar-header-top {
  display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;
}
.sidebar-driver-name { font-weight: 700; font-size: 0.95rem; color: var(--brand-maastricht); }
.sidebar-driver-zone { font-size: 0.78rem; color: var(--brand-light-blue); margin-top: 2px; }

.sidebar-close {
  width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--brand-cyan-border);
  background: var(--brand-cyan-soft); color: var(--brand-light-blue); font-size: 0.8rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sidebar-close:hover { background: var(--brand-cyan-border); }

.sidebar-stats { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
.sidebar-flags { display: flex; gap: 5px; flex-wrap: wrap; }

.stat-chip {
  font-size: 0.72rem; font-weight: 600; padding: 2px 8px;
  border-radius: 99px; background: var(--brand-cyan-soft); color: var(--brand-blue);
}
.stat-chip.highlight { background: var(--brand-cyan); color: var(--brand-surface); }
.stat-chip.warn { background: var(--brand-warning-soft); color: #8A3F13; border: 1px solid var(--brand-warning-border); }

.sidebar-legend {
  display: flex; gap: 8px; flex-wrap: wrap; padding: 6px 14px;
  border-bottom: 1px solid var(--brand-subtle); background: var(--brand-surface-soft); flex-shrink: 0;
}
.pl-item { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--brand-muted); }
.pl-dot  { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

/* ── Stop list ── */
.sidebar-stops { flex: 1; overflow-y: auto; padding: 2px 0; }

.stop-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; cursor: pointer;
  border-bottom: 1px solid var(--brand-subtle);
  transition: background 0.1s;
  border-left: 3px solid transparent;
}
.stop-row:hover { background: var(--brand-surface-soft); }
.stop-row.active { background: var(--brand-blue-soft); border-left-color: var(--brand-light-blue); }

.stop-seq {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--brand-surface); font-weight: 700; font-size: 0.75rem; margin-top: 1px;
}

.stop-info { flex: 1; min-width: 0; }
.stop-name {
  font-weight: 600; font-size: 0.83rem; color: var(--brand-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stop-addr {
  font-size: 0.75rem; color: var(--brand-muted); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stop-meta { display: flex; align-items: center; gap: 5px; margin-top: 5px; flex-wrap: wrap; }
.stop-weight { font-size: 0.72rem; color: var(--brand-muted-2); }
.stop-flag { font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 99px; }
.priority-flag { color: var(--brand-surface); }
.fragile-flag  { background: var(--brand-warning-soft); color: #8A3F13; }
.mismatch-flag { background: var(--brand-danger-soft); color: var(--brand-orange); }
.street-flag   { background: var(--brand-subtle); color: var(--brand-muted); }
.special-flag  { background: var(--brand-blue-soft); color: var(--brand-blue); font-style: normal; }

.spinner-sm {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid var(--brand-cyan-border); border-top-color: var(--brand-light-blue);
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
