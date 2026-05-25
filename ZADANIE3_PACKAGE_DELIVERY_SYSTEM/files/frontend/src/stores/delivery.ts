import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '@/api/http'

export interface Driver {
  driver_id: string
  first_name: string
  last_name: string
  phone: string
  vehicle_id: string
  vehicle_make_model: string
  vehicle_type: string
  license_plate: string
  max_weight_kg: number
  max_volume_m3: number
  max_packages_count: number
  zone_mestska_cast: string
  years_experience: number
  shift_start: string
  shift_end: string
  lat: number
  lon: number
}

export interface PackageItem {
  id: number
  barcode: string
  recipient_name: string
  address: string
  city_district: string
  package_type: string
  size: string
  weight_kg: number
  volume_m3: number
  fragile: boolean
  priority: string
  payment_method: string
  cod_amount_eur: number | null
  special_instructions: string | null
  status: string
  lat: number
  lon: number
}

export interface AssignmentItem {
  id: number
  driver_id: string
  first_name: string
  last_name: string
  zone: string
  vehicle_type: string
  license_plate: string
  package_id: number
  barcode: string
  recipient_name: string
  address: string
  city_district: string
  weight_kg: number
  volume_m3: number
  dimensions_cm: string | null
  priority: string
  fragile: boolean
  geocode_status: string | null
  lat: number
  lon: number
  sequence_number: number
  special_instructions: string | null
}

export interface ZoneStat {
  zone: string
  total_packages: number
  assigned: number
  unassigned: number
  drivers: number
  capacity_weight_kg: number
  used_weight_kg: number
  weight_utilization_pct: number
  capacity_volume_m3: number
  used_volume_m3: number
  volume_utilization_pct: number
}

export interface DriverStat {
  driver_id: string
  first_name: string
  last_name: string
  zone_mestska_cast: string
  vehicle_type: string
  vehicle_make_model: string
  license_plate: string
  max_weight_kg: number
  max_volume_m3: number
  max_packages_count: number
  assigned_packages: number
  assigned_weight_kg: number
  assigned_volume_m3: number
  weight_utilization_pct: number
  volume_utilization_pct: number
  count_utilization_pct: number
  lat: number
  lon: number
}

export interface StatsResponse {
  total_packages: number
  assigned: number
  unassigned: number
  unresolved: number
  zones: ZoneStat[]
  drivers: DriverStat[]
}

export const useDeliveryStore = defineStore('delivery', () => {
  const stats      = ref<StatsResponse | null>(null)
  const drivers    = ref<Driver[]>([])
  const assignments = ref<AssignmentItem[]>([])
  const geojson    = ref<Record<string, unknown> | null>(null)
  const unassignedGeojson = ref<Record<string, unknown> | null>(null)
  const optimizing = ref(false)
  const loading    = ref(false)
  const error      = ref<string | null>(null)
  const selectedDriverId = ref<string | null>(null)

  async function fetchStats() {
    const res = await apiFetch('/stats')
    stats.value = await res.json()
  }

  async function fetchDrivers() {
    const res = await apiFetch('/drivers')
    drivers.value = await res.json()
  }

  async function fetchAssignments() {
    const res = await apiFetch('/assignments')
    assignments.value = await res.json()
  }

  async function fetchGeojson() {
    const [a, u] = await Promise.all([
      apiFetch('/assignments/geojson'),
      apiFetch('/unassigned/geojson'),
    ])
    geojson.value = await a.json()
    unassignedGeojson.value = await u.json()
  }

  async function optimize(fixDistricts = false) {
    optimizing.value = true
    error.value = null
    try {
      const qs = fixDistricts ? '?fix_districts=true' : ''
      const res  = await apiFetch(`/optimize${qs}`, { method: 'POST' })
      const data = await res.json()
      await Promise.all([fetchStats(), fetchAssignments(), fetchGeojson()])
      return data as { districts_fixed: number }
    } catch (e) {
      error.value = String(e)
    } finally {
      optimizing.value = false
    }
  }

  async function clearAssignments() {
    await apiFetch('/assignments', { method: 'DELETE' })
    assignments.value = []
    geojson.value = null
    unassignedGeojson.value = null
    await fetchStats()
  }

  async function init() {
    loading.value = true
    try {
      await Promise.all([fetchStats(), fetchDrivers()])
      if (stats.value && stats.value.assigned > 0) {
        await Promise.all([fetchAssignments(), fetchGeojson()])
      }
    } finally {
      loading.value = false
    }
  }

  return {
    stats, drivers, assignments, geojson, unassignedGeojson,
    optimizing, loading, error, selectedDriverId,
    fetchStats, fetchDrivers, fetchAssignments, fetchGeojson,
    optimize, clearAssignments, init,
  }
})
