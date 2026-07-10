import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'print', component: () => import('../views/PrintView.vue'), meta: { title: '打印' } },
  { path: '/manage', name: 'manage', component: () => import('../views/ManageView.vue'), meta: { title: '管理' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
