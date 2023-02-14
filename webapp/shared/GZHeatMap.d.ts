import { JSXInternal } from "preact/src/jsx";

class GZHeatMap extends HTMLElement {
	gzdata: Metadata | null;
}

declare module "preact" {
	namespace JSX {
		interface IntrinsicElements {
			"gz-heatmap": JSXInternal.HTMLAttributes<GZHeatMap> & {
				gzdata?: Metadata | null;
			};
		}
	}
}
