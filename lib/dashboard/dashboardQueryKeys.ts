export const dashboardKeys = {
  all: ['dashboard'] as const,
  bootstrap: () => ['dashboard', 'bootstrap'] as const,
  shell: () => ['dashboard', 'shell'] as const,
  hero: () => ['dashboard', 'hero'] as const,
  heavy: () => ['dashboard', 'heavy'] as const,
}
