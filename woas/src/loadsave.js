// load modes which should be supported by load/save browser bindings
woas.file_mode = {
	UTF8_TEXT:		0,
	ASCII_TEXT:		1,
	DATA_URI:		2,
	BINARY:			3,
	BASE64:			4
};

// save the currently open WoaS
woas._save_this_file = function(new_data, old_data) {
	var filename = _get_this_filename();

	var r = woas.save_file(filename, this.file_mode.ASCII_TEXT,
		this.DOCTYPE + this.DOC_START + "<sc"+"ript type=\"tex"+"t/javascript\">"
		+ new_data + "\n" + old_data + "</"+"html>");
	if (r===true)
		log("\""+filename+"\" saved successfully");	// log:1
	else {
		var msg = this.i18n.SAVE_ERROR.sprintf(filename) + "\n\n";
		if (this.use_java_io) {
			// try to understand what went bad with Java
			if (typeof document.applets.TiddlySaver == "undefined")
				msg += this.i18n.NO_TIDDLY_SAVER+" "+TIDDLY_HELP;
			else if (typeof java == "undefined")
				msg += this.i18n.NO_JAVA+" "+TIDDLY_HELP;
			else
				msg += this.i18n.UNSPECIFIED_JAVA_ERROR;
		} else
			msg += woas.i18n.UNSUPPORTED_BROWSER.sprintf(navigator.userAgent);
		this.alert(msg);
	}
	return r;
}

//API1.0: save-file handler
//NOTE: save_mode is not always enforced by browser binding
woas.save_file = function(fileUrl, save_mode, content) {
	var r = null;
	if (!this.use_java_io) {
		r = this.mozillaSaveFile(fileUrl, save_mode, content);
		if((r === null) || (r === false))
			r = this.ieSaveFile(fileUrl, save_mode, content);
		// fallback to try also with Java saving
	} else
		return this.javaSaveFile(fileUrl, save_mode, content);
	if((r === null) || (r === false))
		r = this.javaSaveFile(fileUrl, save_mode, content);
	return r;
};

// get file content in FF3 without .enablePrivilege() (FBNil)
woas.mozillaLoadFileID = function(obj_id, load_mode, suggested_mime) {
	var obj = document.getElementById(obj_id);
	if(!window.Components || !obj.files)
		return null;
	var D=obj.files.item(0);
	if (D === null)
		return false;
	
	if (load_mode === this.file_mode.DATA_URI) {
		if (typeof "suggested_mime" !== "string")
			return D.getAsDataURL();
		else // apply mime override
			return D.getAsDataURL().replace(/^data:(\s*)([^;]*)/, "data:$1"+suggested_mime);
	} else if (load_mode === this.file_mode.BASE64) {
		return D.getAsDataURL().replace(/^data:\s*([^;]*);\s*base64,\s*/, '');
	} else if (load_mode === this.file_mode.BINARY) {
		return D.getAsBinary();
	}
	// case UTF8_TEXT:
	// case ASCII_TEXT:
	// return UTF-8 text by default
	return D.getAsText("utf-8");
};

// API1.0: load-file handler
woas.load_file = function(fileUrl, load_mode, mime){
	// parameter consistency check
	if (!load_mode)
		// perhaps should be ASCII?
		load_mode = this.file_mode.UTF8_TEXT;
	// try loading the file without using the path (FF3+)
	// (object id hardcoded here)
	var r = null;
	if (!this.use_java_io) {
		// correctly retrieve fileUrl
		if (fileUrl === null) {
			if (this.browser.firefox3 || this.browser.firefox_new)
				r = this.mozillaLoadFileID("filename_", load_mode, mime);
			else
				fileUrl = this.get_input_file_url();
		}
		if (r === null) // load file using file absolute path
			r = this.mozillaLoadFile(fileUrl, load_mode, mime);
		else return r;
		if(r === false)
			return false;
		// no mozillas here, attempt the IE way
		if (r === null)
			r = this.ieLoadFile(fileUrl, load_mode, mime);
		else return r;
		if (r === false)
			return false;
//		if (r === null)
			// finally attempt to use Java
//			r = this.javaLoadFile(fileUrl, load_mode);
	} else {
		if (fileUrl === null)
			fileUrl = this.get_input_file_url();
		if (fileUrl === false)
			return false;
		r = this.javaLoadFile(fileUrl, load_mode, mime);
	}
	if (r === false)
		return false;
	if (r === null) {
		this.alert('Could not load "'+fileUrl+'"');
		return null;
	}
	// wow, java worked!
	return r;
};

// the following load/save bindings will return:
// * null if they can't do it
// * false if there's an error
// * true if it saved OK
// * string with content if content was read successfully

// save through ActiveX
woas.ieSaveFile = function(filePath, save_mode, content) {
	var s_mode;
	switch (save_mode) {
		case this.file_mode.BINARY:
		case this.file_mode.ASCII_TEXT:
			s_mode = 0; // ASCII
		break;
		default:
			// DATA_URI and UTF8_TEXT modes
			s_mode = -1; // Unicode mode 
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
};

// load through ActiveX
woas.ieLoadFile = function(filePath, load_mode, suggested_mime) {
	var o_mode;
	switch (load_mode) {
		case this.file_mode.BINARY:
		case this.file_mode.ASCII_TEXT:
			o_mode = 0; // ASCII
		break;
		default:
			// DATA_URI and UTF8_TEXT modes
			o_mode = -1; // Unicode
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
		content = file.ReadAll();
		file.Close();
	}
	catch(e) {
		log("Exception while attempting to load\n\n" + e.toString());	// log:1
		return false;
	}
	// return a valid DATA:URI
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content, suggested_mime);
	else if (load_mode == this.file_mode.BASE64)
		return encode64(content);
	// fallback for UTF8_TEXT
	return(content);
};

// save through UniversalXPConnect
woas.mozillaSaveFile = function(filePath, save_mode, content) {
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
};

// load through UniversalXPConnect
woas.mozillaLoadFile = function(filePath, load_mode, suggested_mime) {
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
		inputStream.init(file, 0x01, 04, 0);
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
				return(this.merge_bytes(rd));
		else if (load_mode == this.file_mode.DATA_URI)
			return this._data_uri_enc(filePath, this.merge_bytes(rd), suggested_mime);
		else if (load_mode == this.file_mode.BASE64)
			return encode64_array(rd);
	}
	catch(e) {
		log("Exception while attempting to load\n\n" + e);	// log:1
	}
	return false;
};

// creates a DATA:URI from a plain content stream
woas._data_uri_enc = function(filename, ct, guess_mime) {
	if (typeof guess_mime != "string") {
		var m=filename.match(/\.(\w+)$/);
		if (m===null) m = "";
		else m=m[1].toLowerCase();
		guess_mime = "image";
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
	}
	// perform base64 encoding
	return "data:"+guess_mime+";base64,"+encode64(ct);
};

//FIXME: save_mode is not enforced
woas.javaSaveFile = function(filePath,save_mode,content) {
	if ((save_mode != this.file_mode.ASCII_TEXT) && (save_mode != this.file_mode.UTF8_TEXT)) {
		log("Only ASCII and UTF8 file modes are supported with Java/TiddlySaver");	//log:1
		return false;
	}
	try {
		if(document.applets.TiddlySaver) {
			var rv = document.applets.TiddlySaver.saveFile(filePath,"UTF-8",content);
			if (typeof rv == "undefined") {
				log("Save failure, this is usually a Java configuration issue");
				return null;
			} else {
				return rv ? true : false;
			}
		}
	} catch(ex) {
		// report but check next method
		log("TiddlySaver applet not available"); //log:1
	}
	// check if no JRE is available
	if (typeof java == "undefined") {
		log("No JRE detected"); //log:1
		return null;
	}
	// try reading the file with java.io
	try {
		var s = new java.io.PrintStream(new java.io.FileOutputStream(filePath));
		s.print(content);
		s.close();
	} catch(ex) {
		log(ex.toString());
		return false;
	}
	return true;
};

//FIXME: UTF8_TEXT/BINARY is not enforced here
woas.javaLoadFile = function(filePath, load_mode, suggested_mime) {
	var content = null;
	try {
		if(document.applets.TiddlySaver) {
			content = document.applets.TiddlySaver.loadFile(filePath, "UTF-8");
			if (content === null) {
				log("Load failure, maybe file does not exist?"); //log:1
				return false;
			}
			// check that it is not an "undefined" string
			if (typeof content == "undefined") {
				log("Load failure, this is usually a Java configuration issue"); //log:1
				return null;
			}
			// convert to string only after checking that it was successfully loaded
			content = String(content);
			if (load_mode == this.file_mode.DATA_URI)
				return this._data_uri_enc(filePath, content, suggested_mime);
			else if (load_mode == this.file_mode.BASE6)
				return encode64(content);
			return content;
		}
	} catch(ex) {
		// report but check next method
		log("TiddlySaver applet not available"); //log:1
	}
	// check if no JRE is available
	if (typeof java == "undefined") {
		log("No JRE detected"); //log:1
		return null;
	}
	var a_content = [];
	try {
		var r = new java.io.BufferedReader(new java.io.FileReader(filePath));
		var line;
		while((line = r.readLine()) !== null)
			a_content.push(new String(line));
		r.close();
	} catch(ex) {
		log("Exception in javaLoadFile(\""+filePath+"\"): "+ex);
		return false;
	}
	// re-normalize input
	content = a_content.join("\n");
	if (load_mode == this.file_mode.DATA_URI)
		return this._data_uri_enc(filePath, content, suggested_mime);
	else if (load_mode == this.file_mode.BASE64)
		return encode64(content);
	return content;
};

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
	var s = "",it=arr.length-1;
	for(var i=0;i<it;i++) {
		if (arr[i]>=1000)
			s += "0x"+arr[i].toString(16) + ",";
		else
			s+=arr[i].toString() + ",";
	}
	// do not write comma on last element, workaround due to IE6 not recognizing it
	if (it>0) {
		if (arr[it]>=1000)
			s += "0x"+arr[it].toString(16);
		else
			s+=arr[it].toString();
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
woas._save_to_file = function(full) {
	this.progress_init("Saving to file");
	
	// increase the marker only when performing full save
	var new_marker = full ? _inc_marker(__marker) : __marker;
	
	// setup the page to be opened on next start
	var safe_current;
	if (this.config.nav_history) {
		if (!this.page_exists(current))
			safe_current = this.config.main_page;
		else safe_current = current;
	} else
		safe_current = this.config.main_page;
	
	// output the javascript header and configuration flags
	var computed_js = "\n/* <![CDATA[ */\n\n/* "+new_marker+"-START */\n\nvar woas = {\"version\": \""+this.version+
	"\"};\n\nvar __marker = \""+new_marker+"\";\n\nwoas[\"config\"] = {";
	for (var param in this.config) {
		computed_js += "\n\""+param+"\":";
		switch(typeof(this.config[param])) {
			case "boolean":
				computed_js += (this.config[param] ? "true" : "false")+",";
			break;
			case "string":
				computed_js += "'"+this.js_encode(this.config[param])+"',";
			break;
			default: // for numbers
				computed_js += this.config[param]+",";
			break;
		}
	}
	computed_js = computed_js.substr(0,computed_js.length-1);
	computed_js += "};\n";
	
	computed_js += "\nvar current = '" + this.js_encode(safe_current)+"';\n\n";
	
	computed_js += "var backstack = [\n" + printout_arr(this.config.nav_history ? backstack : [], false) + "];\n\n";
	
	// in WSIF datasource mode we will save empty arrays
	if (this.config.wsif_ds.length !== 0)
		computed_js += "var page_titles = [\n];\n\n";
	else
		computed_js += "var page_titles = [\n" + printout_arr(page_titles, false) + "];\n\n";
	
	computed_js += "/* " + new_marker + "-DATA */\n";

	// force full mode if WSIF datasource mode changed since last time loading/saving
	var ds_changed = (this.config.wsif_ds.length !== this._old_wsif_ds_len);
	if (full || ds_changed) {
		this._old_wsif_ds_len = this.config.wsif_ds.length;
		if (this.config.wsif_ds.length) {
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
	var bak_ed = $("woas_editor").value;
	var bak_tx = $("wiki_text").innerHTML;
	var bak_mn = $("menu_area").innerHTML;
	var bak_mts = $("wiki_mts").innerHTML;
	var bak_mts_shown = $.is_visible("wiki_mts");
	var bak_wait_text = this.getHTML($("woas_wait_text"));
	var bak_debug = $("woas_debug_log").value;
	// clear titles and css as well as they will be set on load.
	var bak_title = $("wiki_title").innerHTML;

	if (bak_mts_shown)
		$.hide("wiki_mts");
	$("woas_editor").value = "";
	$("wiki_text").innerHTML = "";
	$("menu_area").innerHTML = "";
	$("wiki_mts").innerHTML = "";
	$("woas_debug_log").value = "";
	$("wiki_title").innerHTML = "";

	this._clear_custom_scripts();
	this._clear_plugins();

	// set the loading message
	this.setHTML($("woas_wait_text"), this.i18n.LOADING);
	// temporarily display such message
	$.show("loading_overlay");
	var bak_cursor = document.body.style.cursor;
	document.body.style.cursor = "auto";

	var data = this._extract_src_data(__marker, document.documentElement.innerHTML, full | ds_changed, safe_current);
	
	// data is ready, now the actual save process begins
	var r=false;
	$.hide("loading_overlay");
	this.setHTML($("woas_wait_text"), bak_wait_text);
	document.body.style.cursor = bak_cursor;

	//DEBUG check
	if (data.length === 0) {
		this.crash("Could not retrieve original DOM data!");
	} else {
	
//	if (!this.config.server_mode || (was_local && this.config.server_mode)) {
	if (!this._server_mode)
		r = this._save_this_file(computed_js, data);
//		was_local = false;
//	}

	// save was successful - trigger some events
	if (r) {
		this.after_config_saved();
		if (full)
			this.after_pages_saved();
	}
	} //DEBUG check

	$("woas_editor").value = bak_ed;
	$("wiki_text").innerHTML = bak_tx;
	$("menu_area").innerHTML = bak_mn;
	$("wiki_mts").innerHTML = bak_mts;
	if (bak_mts_shown)
		$.show("wiki_mts");
	$("woas_debug_log").value = bak_debug;
	$("wiki_title").innerHTML = bak_title;
	
	// it shouldn't really be necessary to re-create scripts but
	// we recreate them so that DOM scripts are always consistent
	// with runtime javascript data/code
	this._activate_scripts(true);
	this._load_plugins(true);
	
	this.progress_finish();
	
	return r;
};

var reHeadTagEnd = new RegExp("<\\/"+"head>", "ig"),
	reTitleS = new RegExp("<"+"title", "ig"),
	reStyleS = new RegExp("<"+"style", "ig"),
	reTitleE = new RegExp("<"+"/title"+">", "ig"),
	reStyleE = new RegExp("<"+"/style"+">", "ig");
woas._extract_src_data = function(marker, source, full, current_page, start) {
	var e_offset, s_offset,
		title_wasted = false;	// to tell if title was before start marker
	// find the start marker for safety checking
	s_offset = source.indexOf("/* "+marker+ "-START */");
	if (s_offset === -1) {
		this.alert(this.i18n.ERR_MARKER.sprintf("START"));
		return false;
	}			
	// find the end marker, necessary to make some DOM/XHTML fixes
	e_offset = source.indexOf("/* "+marker+ "-END */", s_offset);
	if (e_offset === -1) {
		this.alert(this.i18n.ERR_MARKER.sprintf("END"));
		return false;
	}
	// properly update offset
	e_offset += 3 + marker.length + 7;
	
	// search for head end tag starting at offset
	reHeadTagEnd.lastIndex = e_offset;
	
	//RFC: what does below comment mean?
	// IE ...
	var body_ofs,
		m = reHeadTagEnd.exec(source);
	if (m !== null)
		body_ofs = m.index;
	else
		body_ofs = -1;
	//RFC: does body_ofs ever evaluate to -1?
	if (body_ofs !== -1) {
		// IE is the only browser which moves tag around
		if (this.browser.ie)
			reTitleS.lastIndex = 0;
		else
			reTitleS.lastIndex = e_offset;
		// fix document title directly without modifying DOM
		var title_end, title_start = reTitleS.exec(source);
		if (title_start === null)
			title_start = -1;
		else title_start = title_start.index;
		// check that we did not pick something from the data area
		if ((title_start>=s_offset) && (title_start<=e_offset)) {
			this.crash("Document title tag in data area");
		} else {
			if (title_start === -1)
				this.crash("Cannot find document title start tag");
			else {
				reTitleE.lastIndex = title_start;
				title_end = reTitleE.exec(source);
				if (title_end === null)
					title_end = -1;
				else title_end = title_end.index;
				if (title_end === -1)
					this.crash("Cannot find document title end tag");
				else {
					// this happens usually on IE - so we skip title replacing here
					title_wasted = (title_start < s_offset);
					if (!title_wasted) {
						// replace with current page title
						var new_title = this.xhtml_encode(current_page);
						source = source.substring(0, title_start) + "<"+"title"+">"+
								new_title
								+ source.substring(title_end);
						// update offset accordingly
						body_ofs += new_title.length + 7 - (title_end - title_start);
					}
				}
			}
		}
		// IE is the only browser which moves tag around
		if (this.browser.ie)
			reStyleS.lastIndex = 0;
		else
			reStyleS.lastIndex = e_offset;
		// replace CSS directly without modifying DOM
		var css_end, css_start = reStyleS.exec(source);
		if (css_start === null)
			css_start = -1;
		else css_start = css_start.index;
		if ((css_start>=s_offset) && (css_start<=e_offset)) {
			this.crash("Document style tag in data area");
		} else {
			if (css_start === -1)
				this.crash("Cannot find CSS style start tag");
			else {
				reStyleE.lastIndex = css_start;
				css_end = reStyleE.exec(source);
				if (css_end === null)
					css_end = -1;
				else css_end = css_end.index;
				if (css_end === -1)
					this.crash("Cannot find CSS style end tag");
				else {
					var boot_css = this.get_text("WoaS::CSS::Boot"),
						stStartTag = "<"+"style type=\"text/css\""+">",
						bonus;
					// now add the title if it was wasted
					if (title_wasted)
						bonus = "<"+"tit"+"le>"+this.xhtml_encode(current_page)+"<"+"/ti"+"tle"+">\n";
					else bonus = "";
					bonus += stStartTag;
					//this._customized_popup("test", "<"+"tt>"+this.xhtml_encode(source.substring(css_start, css_end))+"<"+"/tt>", "");
					// we have found the style tag, replace it
					source = source.substring(0, css_start) + 
								bonus +
								boot_css
								+ source.substring(css_end);
					// update offset
					var delta = boot_css.length + bonus.length - (css_end - css_start);
					delete boot_css;
					body_ofs += delta;
					// this should really never happen
/*					if (css_start < s_offset) {
						e_offset += delta;
						s_offset += delta;
					} */
				}
			}
		}
		// XHTML hotfixes (FF doesn't either save correctly)
		var l;
		source = source.substring(0, body_ofs) + source.substring(body_ofs).
				replace(/<(img|hr|br|input|meta)[^>]*>/gi, function(str, tag) {
					l=str.length;
					if (str.charAt(l-1)!=='/')
						str = str.substr(0, l-1)+" />";
					return str;
		});
		// remove the tail (if any)
		var tail_end_mark = "<"+"!-- "+marker+"-TAIL-END -"+"->",
			tail_st_mark = "<"+"!-- "+marker+"-TAIL-START --"+">",
			tail_start = source.indexOf(tail_st_mark, e_offset);
		if (tail_start !== -1) {
			var tail_end = source.indexOf(tail_end_mark, tail_start);
			if (tail_end === -1)
				log("Cannot find tail end!"); //log:1
			else {
				// remove the tail content (but not the tail itself)
				source =	source.substring(0, tail_start + tail_st_mark.length)+
							source.substring(tail_end+tail_end_mark.length);
				alert(source);
			}
		}
	}
	if (full) {
		// offset was previously calculated
		if (start) {
			s_offset = source.indexOf("/* "+marker+ "-START */");
			if (s_offset == -1) {
				this.alert(this.i18n.ERR_MARKER.sprintf("START"));
				return false;
			}
			return source.substring(s_offset, e_offset);
		}
	} else {
		e_offset = source.indexOf("/* "+marker+ "-DATA */", s_offset);
		if (e_offset === -1) {
			this.alert(this.i18n.ERR_MARKER.sprintf("DATA"));
			return false;
		}
		e_offset += 3 + marker.length + 8;
	}
	return source.substring(e_offset);
}

// increment the save-counter portion of the marker
var reMarker = /([^\-]*)\-(\d{7,7})$/;
function _inc_marker(old_marker) {
	var m = old_marker.match(reMarker);
	if (m===null) {
		return _random_string(10)+"-0000001";
	}
	var n = new Number(m[2].replace(/^0+/, '')) + 1;
	n = n.toString();
	// marker part + 0-padded save count number
	return m[1]+"-"+String("0").repeat(7-n.length)+n;
}

// load URL via XHR
woas.remote_load = function(url) {
	var HttpReq = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
	HttpReq.open('GET', url, false);
	HttpReq.setRequestHeader('Content-Type', 'text/plain')
	HttpReq.send(null);
	return HttpReq.responseText;
}
