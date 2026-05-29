<script lang="ts">
	import { TooltipProvider } from '@/components/ui/tooltip';
	let { component: Component, ...props } = $props<{ component: any }>();
</script>

<TooltipProvider delayDuration={0}>
	<Component {...props} />
</TooltipProvider>
