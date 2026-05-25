import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import MapView from '@/views/MapView.vue'
import DriversView from '@/views/DriversView.vue'
import UnresolvedView from '@/views/UnresolvedView.vue'
import DriverRouteView from '@/views/DriverRouteView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                        component: DashboardView },
    { path: '/map',                     component: MapView },
    { path: '/drivers',                 component: DriversView },
    { path: '/unresolved',              component: UnresolvedView },
    { path: '/driver/:driverId',        component: DriverRouteView },
  ],
})

export default router
