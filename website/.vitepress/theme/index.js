import DefaultTheme from 'vitepress/theme-without-fonts';
import Layout from './Layout.vue';
import HomePage from './HomePage.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) { app.component('HomePage', HomePage); }
};
