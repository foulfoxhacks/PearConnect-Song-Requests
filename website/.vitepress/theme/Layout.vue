<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme-without-fonts';

const { page } = useData();
const canonical = computed(() => 'https://pearconnect.mellozone.site/' + page.value.relativePath.replace(/index\.md$/, '').replace(/\.md$/, ''));
</script>

<template>
  <div itemscope itemtype="https://schema.org/WebPage" :itemid="`${canonical}#webpage`" :class="{ 'session-layout-page': page.frontmatter.session }">
    <meta itemprop="name" :content="`${page.title} | PearConnect`">
    <meta itemprop="url" :content="canonical">
    <meta itemprop="description" :content="page.description">
    <meta itemprop="inLanguage" content="en-US">
    <DefaultTheme.Layout />
  </div>
</template>
