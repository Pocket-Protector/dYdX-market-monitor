import adapterAuto from '@sveltejs/adapter-auto';
import adapterVercel from '@sveltejs/adapter-vercel';

const isVercelBuild = process.env.VERCEL === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Local Windows builds can fail when adapter-vercel creates .func symlinks.
		// Keep the Vercel adapter for actual Vercel deployments and use auto elsewhere.
		adapter: isVercelBuild ? adapterVercel() : adapterAuto()
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) => ({ runes: !filename.includes('node_modules') })
	}
};

export default config;
