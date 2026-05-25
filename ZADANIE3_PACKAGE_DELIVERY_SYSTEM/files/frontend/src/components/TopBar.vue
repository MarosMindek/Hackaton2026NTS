<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDeliveryStore } from '@/stores/delivery'

const route = useRoute()
const store = useDeliveryStore()

const unresolvedCount = computed(() => store.stats?.unresolved ?? 0)
</script>

<template>
  <header class="topbar">
    <div class="brand">🚚 KE-Delivery</div>
    <nav class="nav">
      <RouterLink to="/"           :class="{ active: route.path === '/' }">Dashboard</RouterLink>
      <RouterLink to="/map"        :class="{ active: route.path === '/map' }">Map</RouterLink>
      <RouterLink to="/drivers"    :class="{ active: route.path === '/drivers' }">Drivers</RouterLink>
      <RouterLink to="/unresolved" :class="{ active: route.path === '/unresolved' }" class="nav-unresolved">
        Unresolved
        <span v-if="unresolvedCount > 0" class="badge">{{ unresolvedCount }}</span>
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 24px;
  min-height: 58px;
  background:
    radial-gradient(circle at 96% 0%, rgba(9, 153, 232, 0.35), transparent 32%),
    linear-gradient(100deg, var(--brand-maastricht) 0%, var(--brand-navy) 54%, var(--brand-blue) 100%);
  box-shadow: 0 10px 26px rgba(10, 27, 81, 0.18);
  flex-shrink: 0;
  position: relative;
  z-index: 20;
}
.brand {
  color: var(--brand-surface);
  font-weight: 800;
  font-size: 1.04rem;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.nav {
  display: flex;
  gap: 6px;
  min-width: 0;
}
.nav a {
  color: rgba(255,255,255,0.74);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 700;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.nav a:hover { color: var(--brand-surface); background: rgba(255,255,255,0.10); }
.nav a.active {
  color: var(--brand-surface);
  background: rgba(9, 153, 232, 0.26);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16);
}
.badge {
  background: var(--brand-orange);
  color: var(--brand-surface);
  font-size: 0.68rem;
  font-weight: 900;
  padding: 1px 7px;
  border-radius: 99px;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .topbar {
    display: block;
    padding: 11px 12px 9px;
    min-height: 0;
  }
  .brand {
    display: block;
    margin-bottom: 9px;
  }
  .nav {
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .nav::-webkit-scrollbar { display: none; }
  .nav a {
    flex: 0 0 auto;
    padding: 8px 12px;
    font-size: 0.84rem;
  }
}
</style>
