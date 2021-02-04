type CodeLengthCategory =
	| "run_length_table"
	| "lz77_length_table"
	| "lz77_dist_table";

interface BitsRead {
	/** The raw bits read from the stream */
	bits: number;
	/** The number of bits read from the stream */
	size: number;
	/**
	 * The decoded value from stream. Could be the value read from a huffman tree,
	 * the bits plus/minus a constant number, etc.
	 */
	decoded: number;
}

interface BasicBitInfo {
	type:
		| "bfinal"
		| "btype"
		| "hlit"
		| "hdist"
		| "hclen"
		| "literal"
		| "block_end";
	value: BitsRead;
}

interface LZ77Value {
	/** The computed value used in the LZ77 back reference */
	value: number;
	/** The symbol that started this LZ77 value */
	symbol: BitsRead;
	/** The extra bits associated  */
	extraBits: BitsRead;
}

interface LZ77BitInfo {
	type: "lz77";
	chars: number[];
	length: LZ77Value;
	dist: LZ77Value;
}

interface HuffmanCodeLengths {
	type: "code_length";
	category: CodeLengthCategory;
	/** The decoded code length these bits represent */
	huffmanCodeLength: number;
	/**
	 * The "character" in the relevant alphabet this code length represents. For
	 * lz77_length_table, this is a value between 0 - 287 (with 0 - 255
	 * representing literal bytes/characters).
	 */
	char: number;
	/** Huffman encoded code length */
	value: BitsRead;
}

interface RepeatHuffmanCodeLengths {
	type: "repeat_code_length";
	category: CodeLengthCategory;
	/** The decoded huffman code length to repeat */
	huffmanCodeLength: number;
	/** The characters this repeated huffman code length applies to */
	chars: number[];
	/** The symbol that represents what kind of repeat this is (16, 17, or 18) */
	symbol: BitsRead;
	/** The count to repeat this code length */
	repeatCount: BitsRead;
}

interface GzipHeader {
	type: "gzip_header";
	bytes: Uint8Array;
}

interface GzipFooter {
	type: "gzip_footer";
	bytes: Uint8Array;
}

type BitInfo =
	| BasicBitInfo
	| LZ77BitInfo
	| HuffmanCodeLengths
	| RepeatHuffmanCodeLengths
	| GzipHeader
	| GzipFooter;

type BitInfoType = BitInfo["type"];

type Metadata = BitInfo[];
