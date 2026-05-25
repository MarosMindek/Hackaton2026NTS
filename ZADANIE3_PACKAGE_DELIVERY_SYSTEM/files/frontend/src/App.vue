<script setup lang="ts">
import { onMounted } from 'vue'
import TopBar from '@/components/TopBar.vue'
import { useDeliveryStore } from '@/stores/delivery'

const store = useDeliveryStore()
onMounted(() => store.init())
</script>

<template>
  <div class="app">
    <TopBar />
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  /* FPT Digital / FDX brand palette from the supplied guideline */
  --brand-maastricht: #0A1B51;
  --brand-navy: #162670;
  --brand-charcoal: #1A308B;
  --brand-blue: #0647C9;
  --brand-light-blue: #0960D3;
  --brand-cyan: #0999E8;
  --brand-white-smoke: #F6F6F6;
  --brand-eerie: #1A1919;

  --brand-orange: #F36E27;
  --brand-amber: #F99D20;
  --brand-yellow: #F1C40F;
  --brand-lime: #A5CD39;
  --brand-green: #2BA94F;
  --brand-teal: #0092B3;
  --brand-indigo: #5B5BD8;
  --brand-purple: #7047B2;
  --brand-magenta: #A449A1;

  --brand-bg: #F4F8FD;
  --brand-surface: #FFFFFF;
  --brand-surface-soft: #F8FBFF;
  --brand-subtle: #EEF5FC;
  --brand-border: #DDE8F6;
  --brand-border-strong: #C7D7EA;
  --brand-text: #0A1B51;
  --brand-text-soft: #36516F;
  --brand-muted: #6A7C92;
  --brand-muted-2: #8EA0B8;

  --brand-blue-soft: #E8F2FF;
  --brand-blue-soft-strong: #D8E9FF;
  --brand-cyan-soft: #E5F8FF;
  --brand-cyan-border: #B8E5FF;
  --brand-danger-soft: #FFF0EC;
  --brand-danger-border: #FFCAB8;
  --brand-warning-soft: #FFF6E2;
  --brand-warning-border: #FAD185;
  --brand-success-soft: #EAF8EE;
  --brand-success-border: #A9DEB8;

  --brand-shadow: 0 14px 34px rgba(10, 27, 81, 0.10);
  --brand-shadow-soft: 0 6px 18px rgba(10, 27, 81, 0.08);
  --font-heading: 'Gilroy', 'Aptos Display', 'Segoe UI', Arial, sans-serif;
  --font-body: 'Graphik', 'Inter', 'Segoe UI', Arial, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app {
  height: 100%;
  font-family: var(--font-body);
  color: var(--brand-text);
  background: var(--brand-bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button, input, select, textarea { font: inherit; }
h1, h2, h3, .brand { font-family: var(--font-heading); }
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    radial-gradient(circle at top right, rgba(9, 153, 232, 0.10), transparent 34rem),
    linear-gradient(180deg, #F8FBFF 0%, var(--brand-bg) 48%, #EEF5FC 100%);
}
.app-main { flex: 1; min-height: 0; overflow: auto; }
</style>
