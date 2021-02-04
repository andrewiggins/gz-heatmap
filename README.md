# gz-heatmap

Produce a heatmap of gzip files to better understand how gzip compresses your code

## Acknowledgements

* [gzthermal](https://encode.su/threads/1889-gzthermal-pseudo-thermal-view-of-Gzip-Deflate-compression-efficiency)
  This repository is basically a JS implementation of wicked-cool gzthermal tool. I wanted to add some nifty interactive features gzthermal so I re-implemented it in JavaScript to add them.
* [gzthermal-web](https://github.com/simonw/gzthermal-web)
  How I originally discovered the gzthermal tool.
* [tiny-inflate](https://github.com/foliojs/tiny-inflate)
  The core inflate algorithm is based on [a fork](https://github.com/andrewiggins/tiny-inflate/tree/experiments) of the tiny-inflate JS implementation.
* [fflate](https://github.com/101arrowz/fflate/)
  Another JS inflate implementation I looked at to understand how GZip works
