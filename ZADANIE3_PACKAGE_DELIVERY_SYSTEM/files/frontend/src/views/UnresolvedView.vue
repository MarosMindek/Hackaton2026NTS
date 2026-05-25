<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/api/http'

interface UnresolvedPackage {
  id: number
  barcode: string
  recipient_name: string
  address: string
  city_district: string
  package_type: string
  size: string
  weight_kg: number
  fragile: boolean
  priority: string
  payment_method: string
  cod_amount_eur: number | null
  special_instructions: string | null
  status: string
}

const packages = ref<UnresolvedPackage[]>([])
const loading  = ref(true)
const search   = ref('')
const selZone  = ref('')
const selPriority = ref('')

const PRIORITY_ORDER: Record<string, number> = { Overnight: 0, Expres: 1, Štandard: 2, Ekonomický: 3 }
const PRIORITY_COLORS: Record<string, string> = {
  Overnight: '#F36E27',
  Expres: '#F99D20',
  Štandard: '#0647C9',
  Ekonomický: '#8EA0B8',
}

onMounted(async () => {
  try {
    const res = await apiFetch('/packages/unresolved?limit=1000')
    packages.value = await res.json()
  } finally {
    loading.value = false
  }
})

const zones = computed(() =>
  [...new Set(packages.value.map((p) => p.city_district))].sort()
)

const priorities = computed(() =>
  [...new Set(packages.value.map((p) => p.priority))].sort(
    (a, b) => (PRIORITY_ORDER[a] ?? 9) - (PRIORITY_ORDER[b] ?? 9)
  )
)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return packages.value.filter((p) => {
    if (selZone.value && p.city_district !== selZone.value) return false
    if (selPriority.value && p.priority !== selPriority.value) return false
    if (q && !p.barcode.toLowerCase().includes(q) &&
             !p.recipient_name.toLowerCase().includes(q) &&
             !p.address.toLowerCase().includes(q)) return false
    return true
  })
})
</script>

<template>
  <div class="page">
    <div class="header">
      <div class="title-block">
        <h1>Unresolved Addresses</h1>
        <span class="count-badge" v-if="!loading">{{ filtered.length }} / {{ packages.length }}</span>
      </div>
      <p class="subtitle">
        These packages cannot be routed — either the address was not found, or its
        coordinates fall outside all Košice district polygons. They need manual review.
      </p>
    </div>

    <div class="filters">
      <input
        v-model="search"
        class="search"
        placeholder="Search barcode, name or address…"
      />
      <select v-model="selZone" class="filter-select">
        <option value="">All districts</option>
        <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
      </select>
      <select v-model="selPriority" class="filter-select">
        <option value="">All priorities</option>
        <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
      </select>
      <button
        v-if="search || selZone || selPriority"
        class="btn-clear"
        @click="search = ''; selZone = ''; selPriority = ''"
      >Clear filters</button>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="spinner"></span> Loading…
    </div>

    <div v-else-if="packages.length === 0" class="empty-state">
      <div class="empty-icon">✓</div>
      <p>No unresolved addresses — all packages have geocoded locations.</p>
    </div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>No packages match the current filters.</p>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Barcode</th>
            <th>Recipient</th>
            <th>Address</th>
            <th>District</th>
            <th>Priority</th>
            <th>Weight</th>
            <th>Flags</th>
            <th>Payment</th>
            <th>COD</th>
            <th>Instructions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pkg in filtered" :key="pkg.id">
            <td class="col-id">{{ pkg.id }}</td>
            <td class="col-barcode">{{ pkg.barcode }}</td>
            <td class="col-name">{{ pkg.recipient_name }}</td>
            <td class="col-address">{{ pkg.address }}</td>
            <td class="col-district">{{ pkg.city_district }}</td>
            <td class="col-priority">
              <span
                class="priority-chip"
                :style="{ background: PRIORITY_COLORS[pkg.priority] ?? '#8EA0B8' }"
              >{{ pkg.priority }}</span>
            </td>
            <td class="col-weight">{{ pkg.weight_kg }} kg</td>
            <td class="col-flags">
              <span v-if="pkg.fragile" class="flag fragile" title="Fragile">⚠</span>
              <span v-if="pkg.cod_amount_eur" class="flag cod" title="Cash on delivery">💶</span>
            </td>
            <td class="col-payment">{{ pkg.payment_method }}</td>
            <td class="col-cod">
              <span v-if="pkg.cod_amount_eur != null">{{ pkg.cod_amount_eur.toFixed(2) }} €</span>
              <span v-else class="na">—</span>
            </td>
            <td class="col-instructions">
              <span v-if="pkg.special_instructions" class="instructions">{{ pkg.special_instructions }}</span>
              <span v-else class="na">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
  background: var(--brand-surface-soft);
}

.header {
  padding: 20px 24px 0;
  flex-shrink: 0;
}
.title-block {
  display: flex; align-items: center; gap: 12px; margin-bottom: 6px;
}
h1 {
  font-size: 1.25rem; font-weight: 700; color: var(--brand-text); margin: 0;
}
.count-badge {
  background: var(--brand-danger-soft); color: var(--brand-orange); border: 1px solid var(--brand-danger-border);
  font-size: 0.78rem; font-weight: 700; padding: 2px 10px; border-radius: 99px;
}
.subtitle {
  font-size: 0.82rem; color: var(--brand-muted); margin: 0 0 16px;
  max-width: 680px; line-height: 1.5;
}

.filters {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 0 24px 14px;
  flex-shrink: 0;
}
.search {
  padding: 7px 14px; border-radius: 8px; border: 1px solid var(--brand-border);
  font-size: 0.85rem; background: var(--brand-surface); color: var(--brand-text);
  width: 280px; outline: none;
}
.search:focus { border-color: var(--brand-blue); box-shadow: 0 0 0 3px rgba(6,71,201,0.14); }
.filter-select {
  padding: 7px 12px; border-radius: 8px; border: 1px solid var(--brand-border);
  font-size: 0.85rem; background: var(--brand-surface); color: var(--brand-text); cursor: pointer; outline: none;
}
.filter-select:focus { border-color: var(--brand-blue); }
.btn-clear {
  padding: 7px 14px; border-radius: 8px; border: 1px solid var(--brand-danger-border);
  background: var(--brand-danger-soft); color: var(--brand-orange); font-size: 0.82rem; cursor: pointer;
}
.btn-clear:hover { background: var(--brand-danger-border); }

.loading-state {
  display: flex; align-items: center; gap: 10px; justify-content: center;
  padding: 60px; color: var(--brand-muted); font-size: 0.9rem;
}
.spinner {
  display: inline-block; width: 18px; height: 18px;
  border: 2px solid var(--brand-border); border-top-color: var(--brand-blue);
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; flex: 1; color: var(--brand-muted); font-size: 0.9rem;
}
.empty-icon { font-size: 2.5rem; }

.table-wrap {
  flex: 1; overflow: auto; padding: 0 24px 24px;
}
table {
  width: 100%; border-collapse: collapse; font-size: 0.82rem;
  background: var(--brand-surface); border-radius: 10px; overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}
thead { position: sticky; top: 0; z-index: 10; }
th {
  background: var(--brand-text); color: var(--brand-muted-2); font-weight: 600; font-size: 0.72rem;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 10px 12px; text-align: left; white-space: nowrap;
}
td {
  padding: 9px 12px; border-bottom: 1px solid var(--brand-subtle);
  color: var(--brand-text-soft); vertical-align: top;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--brand-surface-soft); }

.col-id       { color: var(--brand-muted-2); font-size: 0.75rem; white-space: nowrap; }
.col-barcode  { font-family: monospace; color: var(--brand-blue); white-space: nowrap; }
.col-name     { font-weight: 600; white-space: nowrap; }
.col-address  { color: var(--brand-text-soft); max-width: 220px; }
.col-district { white-space: nowrap; color: var(--brand-text-soft); }
.col-weight   { white-space: nowrap; text-align: right; }
.col-flags    { white-space: nowrap; }
.col-payment  { white-space: nowrap; color: var(--brand-text-soft); font-size: 0.78rem; }
.col-cod      { white-space: nowrap; text-align: right; font-weight: 600; color: var(--brand-text); }
.col-instructions { max-width: 200px; color: var(--brand-text-soft); font-size: 0.78rem; }

.priority-chip {
  display: inline-block; padding: 2px 8px; border-radius: 99px;
  color: var(--brand-surface); font-size: 0.7rem; font-weight: 700; white-space: nowrap;
}
.flag { font-size: 1rem; margin-right: 2px; }
.na   { color: var(--brand-border-strong); }
.instructions { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
</style>
