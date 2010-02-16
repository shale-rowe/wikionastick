
// load modes which should be supported
woas["file_mode"] = {
	UTF8_TEXT:		0,
	ASCII_TEXT:		1,
	DATA_URI:		2,
	BINARY:			3,
	BASE64:			4
}

// save the currently open WoaS
function _saveThisFile(new_data, old_data) {
	var filename = _get_this_filename();
	
	r = woas.save_file(filename, woas.file_mode.UTF8_TEXT,
	woas.DOCTYPE + woas.DOC_START +
	"<sc"+"ript type=\"text/javascript\">" + new_data + "\n" + old_data + "</html>");
	if (r==true)
		log("\""+filename+"\" saved successfully");	// log:1
	else
		this.alert("Save to file \""+filename+"\" failed!\n\nMaybe your browser is not supported");
	return r;
}

//API1.0: save-file handler
woas["save_file"] = function(fileUrl, save_mode, content) {
//	log("javaSaveFile(\""+fileUrl+"\", "+save_mode+", ...("+content.length+" bytes)...)");	//log:0
	var r = null;
	if (!this.use_java_io) {
		r = this.mozillaSaveFile(fileUrl, save_mode, content);
		if((r == null) || (r == false))
			r = this.ieSaveFile(fileUrl, save_mode, content);
		// fallback to try also with Java saving
	} else
		return this.javaSaveFile(fileUrl, save_mode, content);
	if((r == null) || (r == false))
		r = this.javaSaveFile(fileUrl, save_mode, content);
	return r;
}

// get file content in FF3 without .enablePrivilege() (fbnil)
woas["mozillaLoadFileID"] = function(obj_id, load_mode){
	var obj = document.getElementById(obj_id);
	if(!window.Components || !obj.files)
		return null;
	var D=obj.files.item(0);
	switch (load_mode) {
		case this.file_mode.DATA_URI:
			return D.getAsDataURL();
		break;
		case this.file_mode.BASE64:
			// remove the data: part
			return D.getAsDataURL().replace(/^data:\s*([^;]*);\s*base64,\s*/, '');
		break;
		case this.file_mode.BINARY:
			return D.getAsBinary();
		break;
	}
	// case UTF8_TEXT:
	// case ASCII_TEXT:
	// return UTF-8 text by default
	return D.getAsText("utf-8");
}

// *** original source of below functions was from TiddyWiki ***

// API1.0: load-file handler
woas["load_file"] = function(fileUrl, load_mode){
	// parameter consistency check
	if (!load_mode)
		// perhaps should be ASCII?
		load_mode = this.file_mode.UTF8_TEXT;
	// try loading the file without using the path (FF3+)
	// (object id hardcoded here)
	var r = null;
	// we have requested a direct read of the file from the input object
	if (fileUrl === null) {
		if (ff3 || ff_new) {
			r = this.mozillaLoadFileID("filename_", load_mode);
			if (r === false)
				return false;
		} else {
			fileUrl = $("filename_").value;
			if (!fileUrl.length) {
				this.alert(this.i18n.FILE_SELECT_ERR);
				return false;
			}
			// fallthrough is wanted here
		}
	}
	if (!this.use_java_io) {
		if (r === null) // load file using file absolute path
			r = this.mozillaLoadFile(fileUrl, load_mode);
		else return r;
		if(r === false)
			return false;
		// no mozillas here, attempt the IE way
		if (r === null)
			r = this.ieLoadFile(fileUrl, load_mode);
		else return r;
		if (r === false)
			return false;
	}
	if (r === null)
		// finally attempt to use Java
		r = this.javaLoadFile(fileUrl, load_mode);
	if (r === false)
		return false;
	if (r === null) {
		this.alert('Could not load "'+fileUrl+'"');
		return null;
	}
	// wow, java worked!
	return r;
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
woas["ieSaveFile"] = function(filePath, save_mode, content) {
	var s_mode;
	switch (save_mode) {
		case this.file_mode.BINARY:
		case this.file_mode.ASCII_TEXT:
			s_mode = 0; // ASCII
		break;
		case this.file_mode.UTF8_TEXT:
		default:
			// Unicode mode used for DATA_URI and UTF8_TEXT modes
			s_mode = -1;
		break;
	}
	// first let's see if we can do ActiveX
	var fso;
	try	{
		fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch (e) {
		return null;
	}
	try {
		var file = fso.OpenTextFile(filePath, 2, true, s_mode);
		file.Write(content);
		file.Close();
	}
	catch(e) {
		log("Exception while attempting to save: " + e.toString());	// log:1
		return false;
	}
	return(true);
}

// Returns null if it can't do it, false if there's an error, or a string of the content if successful
woas["ieLoadFile"] = function(filePath, load_mode) {
	var o_mode;
	switch (load_mode) {
		case this.file_mode.BINARY:
		case this.file_mode.ASCII_TEXT:
			o_mode = 0; // ASCII
		break;
		case this.file_mode.UTF8_TEXT:
		default:
			// Unicode mode used for DATA_URI and UTF8_TEXT modes
			o_mode = -1;
		break;
	}
	var content = null;
	// first let's see if we can do ActiveX
	var fso;
	try	{
		fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch (e) {
		return null;
	}
	try {
		// attempt to open as unicode
		var file = fso.OpenTextFile(filePath,1,false,o_mode);
		var content = file.ReadAll();
		file.Close();
	}
	catch(e) {
		log("Exception while attempting to load\n\n" + e.toString());	// log:1
		return false;
	}
	// return a valid DATA:URI
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content);
	else if (load_mode == this.file_mode.BASE64)
		return encode64(content);
	// fallback for UTF8_TEXT
	return(content);
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
woas["mozillaSaveFile"] = function(filePath, save_mode, content) {
	if (!window.Components)
		return null;
	//FIXME: save_mode is not considered here
	try	{
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(filePath);
		if (!file.exists())
			file.create(0, 0664);
		else
			log("File \""+filePath+"\" exists, overwriting");	// log:1
		var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
		out.init(file, 0x08 | 0x20 | 0x02, 0700, 0);
		out.write(content, content.length);
		out.flush();
		out.close();
	}
	catch(e) {
		log("Exception while attempting to save\n\n" + e);	// log:1
		return(false);
	}
	return(true);
}

// Returns null if it can't do it, false if there's an error, or a string
// with the content if successful
woas["mozillaLoadFile"] = function(filePath, load_mode) {
	// this is available on Mozilla browsers only
	if (!window.Components)
		return null;
	try	{
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(filePath);
		if (!file.exists()) {
			log("Unexisting file "+filePath);
			return false;
		}
		var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
		inputStream.init(file, 0x01, 00004, 0);
		var sInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		sInputStream.init(inputStream);
		if ( (load_mode == this.file_mode.UTF8_TEXT) ||
			 (load_mode == this.file_mode.ASCII_TEXT))
			return sInputStream.read(sInputStream.available());
		// this byte-by-byte read allows retrieval of binary files
		var tot=sInputStream.available(), i=tot;
		var rd=[];
		while (i-->=0) {
			var c=sInputStream.read(1);
			rd.push(c.charCodeAt(0));
		}
		if (load_mode == this.file_mode.BINARY)
				return(merge_bytes(rd));
		else if (load_mode == this.file_mode.DATA_URI)
			return this._data_uri_enc(filePath, merge_bytes(rd));
		else if (load_mode == this.file_mode.BASE64)
			return encode64_array(rd);
	}
	catch(e) {
		log("Exception while attempting to load\n\n" + e);	// log:1
	}
	return false;
}

// creates a DATA:URI from a plain content stream
woas["_data_uri_enc"] = function(filename, ct) {
	// perform base64 encoding
	ct = encode64(ct);
		
	var m=filename.match(/\.(\w+)$/);
	if (m==null) m = "";
	else m=m[1].toLowerCase();
	var guess_mime = "image";
	switch (m) {
		case "png":
			guess_mime = "image/png";
		break;
		case "gif":
			guess_mime = "image/gif";
			break;
		case "jpg":
		case "jpeg":
			guess_mime = "image/jpeg";
			break;
	}
	return "data:"+guess_mime+";base64,"+ct;
}

function _javaUrlToFilename(url) {
/*	var f = "//localhost";
	if(url.indexOf(f) == 0)
		return url.substring(f.length);
	var i = url.indexOf(":");
	if(i > 0)
		return url.substring(i-1); */
	return url;
}

//FIXME: save_mode is not considered here
woas["javaSaveFile"] = function(filePath,save_mode,content) {
	try {
		if(document.applets["TiddlySaver"])
			return document.applets["TiddlySaver"].saveFile(_javaUrlToFilename(filePath),"UTF-8",content);
	} catch(ex) {
		// ok TiddlySaver applet not available, check next method
	}
	// check if no JRE is available
	if (typeof java == "undefined")
		return null;
	// try reading the file via java
	try {
		var s = new java.io.PrintStream(new java.io.FileOutputStream(_javaUrlToFilename(filePath)));
		s.print(content);
		s.close();
	} catch(ex) {
		log(ex.toString());
		return false;
	}
	return true;
}

woas["javaLoadFile"] = function(filePath, load_mode) {
	//FIXME: UTF8_TEXT/BINARY is not separated here!!
	var content = null;
	try {
		if(document.applets["TiddlySaver"]) {
			content = String(document.applets["TiddlySaver"].loadFile(_javaUrlToFilename(filePath),"UTF-8"));
			if (load_mode == this.file_mode.DATA_URI)
				return this._data_uri_enc(filePath, content);
			else if (load_mode == this.file_mode.BASE6)
				return encode64(content);
			return content;
		}
	} catch(ex) {
		// ok TiddlySaver applet not available, check next method
//		log("TiddlySaver not working: "+e)
	}
	// check if no JRE is available
	if (typeof java == "undefined")
		return null;
	var a_content = [];
	try {
		var r = new java.io.BufferedReader(new java.io.FileReader(_javaUrlToFilename(filePath)));
		var line;
		while((line = r.readLine()) != null)
			a_content.push(new String(line));
		r.close();
	} catch(ex) {
		log("Exception in javaLoadFile(\""+filePath+"\"): "+e)
		return false;
	}
	// re-normalize input
	content = a_content.join("\n");
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content);
	else if (load_mode == this.file_mode.BASE64)
		return encode64(content);
	return content;
}

function printout_arr(arr, split_lines) {

	function elem_print(e) {
		return "'" + woas.js_encode(e, split_lines) + "'";
	}

	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		s += elem_print(arr[i]) + ",\n";
	}
	if (arr.length>1)
		s += elem_print(arr[arr.length-1]) + "\n";
	return s;
}

function printout_mixed_arr(arr, split_lines, attrs) {

	function elem_print(e, attr) {
		if (attr & 2) {
			return "[" + printout_num_arr(e) + "]";
		}
		return "'" + woas.js_encode(e, split_lines) + "'";
	}

	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		s += elem_print(arr[i], attrs[i]) + ",\n";
	}
	if (arr.length>1)
		s += elem_print(arr[arr.length-1], attrs[arr.length-1]) + "\n";
	return s;
}

// used to print out encrypted page bytes and attributes
function printout_num_arr(arr) {
	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		if (arr[i]>=1000)
			s += "0x"+arr[i].toString(16) + ",";
		else
			s+=arr[i].toString() + ",";
	}
	// do not write comma on last element, workaround due to IE6 not recognizing it
	if (arr.length>1) {
		if (arr[arr.length-1]>=1000)
			s += "0x"+arr[arr.length-1].toString(16);
		else
			s+=arr[arr.length-1].toString();
	}

	return s;
}

function printout_fixed(elem, n) {
	var s = (elem+",").repeat(n-1);
	// do not write comma on last element, workaround due to IE6 not recognizing it
	if (n>1)
		s += elem;
	return s;
}

// save full WoaS to file
woas["_save_to_file"] = function(full) {
	// put in busy mode
	$.show("loading_overlay");
	
	var new_marker;
	if (full) {
		new_marker = _inc_marker(__marker);
	} else new_marker = __marker;
	
	// setup the page to be opened on next start
	var safe_current;
	if (this.config.open_last_page) {
		if (!this.page_exists(current)) {
			safe_current = main_page;
		} else safe_current = current;
	} else
		safe_current = main_page;
	
	// output the javascript header and configuration flags
	var computed_js = "\n/* <![CDATA[ */\n\n/* "+new_marker+"-START */\n\nvar woas = {\"version\": \""+this.version+
	"\"};\n\nvar __marker = \""+new_marker+"\";\n\nwoas[\"config\"] = {";
	for (param in this.config) {
		computed_js += "\n\""+param+"\":";
		if (typeof(this.config[param])=="boolean")
			computed_js += (this.config[param] ? "true" : "false")+",";
		else // for numbers
			computed_js += this.config[param]+",";
	}
	computed_js = computed_js.substr(0,computed_js.length-1);
	computed_js += "};\n";
	
	computed_js += "\nvar current = '" + this.js_encode(safe_current)+
	"';\n\nvar main_page = '" + this.js_encode(main_page) + "';\n\n";
	
	computed_js += "var backstack = [\n" + printout_arr(backstack, false) + "];\n\n";
	
	// in native WSIF mode we will save empty arrays

	if (this._auto_native_wsif)
		computed_js += "var page_titles = [\n];\n\n";
	else
		computed_js += "var page_titles = [\n" + printout_arr(page_titles, false) + "];\n\n";
	
	computed_js += "/* " + new_marker + "-DATA */\n";
	
	if (full) {
		if (this._auto_native_wsif) {
			// everything empty when the javascript layer is not used
			computed_js += "var page_attrs = [];\n\n";
			computed_js += "var page_mts = [];\n\n";
			computed_js += "var pages = [\n];\n\n";
		} else {
			computed_js += "var page_attrs = [" + printout_num_arr(page_attrs) + "];\n\n";
			computed_js += "var page_mts = [" + printout_num_arr(page_mts) + "];\n\n";
			computed_js += "var pages = [\n" + printout_mixed_arr(pages, this.config.allow_diff, page_attrs) + "];\n\n";
		}
		computed_js += "/* " + new_marker + "-END */\n";
	}

	// cleanup the DOM before saving
	var bak_ed = $("wiki_editor").value;
	var bak_tx = $("wiki_text").innerHTML;
	var bak_mn = $("menu_area").innerHTML;
	var bak_mts = $("wiki_mts").innerHTML;
	var bak_mts_shown = $.is_visible("wiki_mts");

	if (bak_mts_shown)
		$.hide("wiki_mts");
	$("wiki_editor").value = "";
	$("wiki_text").innerHTML = "";
	$("menu_area").innerHTML = "";
	$("wiki_mts").innerHTML = "";

	this._clear_swcs();
	this._clear_bs();
	
	var data = _get_data(__marker, document.documentElement.innerHTML, full);

	var r=false;
//	if (!this.config.server_mode || (was_local && this.config.server_mode)) {
	if (!this._server_mode)
		r = _saveThisFile(computed_js, data);
//		was_local = false;
//	}

	// save was successful - trigger some events
	if (r) {
		this.after_config_saved();
		if (full)
			this.after_pages_saved();
	}

	
	$("wiki_editor").value = bak_ed;
	$("wiki_text").innerHTML = bak_tx;
	$("menu_area").innerHTML = bak_mn;
	$("wiki_mts").innerHTML = bak_mts;
	if (bak_mts_shown)
		$.show("wiki_mts");
	
	this._create_bs();
	
	$.hide("loading_overlay");
	
	return r;
}

function _get_data(marker, source, full, start) {
	var offset;
	// always find the end marker to make the XHTML fixes
	offset = source.indexOf("/* "+marker+ "-END */");
	if (offset == -1) {
		this.alert(woas.i18n.ERR_MARKER.sprintf("END"));
		return false;
	}			
	offset += 6 + 4 + marker.length + 2;
	
	// IE ...
	var body_ofs;
	var re = new RegExp("<\\/"+"head>", "i");
	var m = re.exec(source);
	if (m != null)
		body_ofs = m.index;
	else
		body_ofs = -1;
	if (body_ofs != -1) {
		// XHTML hotfixes (FF doesn't either save correctly)
		source = source.substring(0, body_ofs) + source.substring(body_ofs).
				replace(/<(img|hr|br|input|meta)[^>]*>/gi, function(str, tag) {
					var l=str.length;
					if (str.charAt(l-1)!='/')
						str = str.substr(0, l-1)+" />";
					return str;
		});
		// remove the tail (if any)
		var s_offset = source.indexOf("<"+"!-- "+marker+"-TAIL-START -->"),
			s_te = "<"+"!-- "+marker+"-TAIL-END -->";
		if (s_offset != -1) {
			var e_offset = source.indexOf(s_te, s_offset);
			if (e_offset == -1)
				log("Cannot find tail end!");
			else {
				// remove the tail
				source =	source.substring(0, s_offset)+
							source.substring(e_offset+s_te.length);
			}
		}
	}
	
	if (full) {
		// offset was previously calculated
		if (start) {
			var s_offset = source.indexOf("/* "+marker+ "-START */");
			if (s_offset == -1) {
				this.alert(woas.i18n.ERR_MARKER.sprintf("START"));
				return false;
			}
			return source.substring(s_offset, offset);
		}
	} else {
		offset = source.indexOf("/* "+marker+ "-DATA */");
		if (offset == -1) {
			this.alert(woas.i18n.ERR_MARKER.sprintf("DATA"));
			return false;
		}
		offset += 6 + 5 + marker.length + 1;
	}
	return source.substring(offset);
}

// increment the save-counter portion of the marker
function _inc_marker(old_marker) {
	var m = old_marker.match(/([^\-]*)\-(\d{7,7})$/);
	if (m==null) {
		return _random_string(10)+"-0000001";
	}
	var n = new Number(m[2].replace(/^0+/, '')) + 1;
	n = n.toString();
	// marker part + 0-padded save count number
	return m[1]+"-"+String("0").repeat(7-n.length)+n;
}
