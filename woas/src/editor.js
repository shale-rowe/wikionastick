
woas["wiki_buttons_display"] = function (v) {
	$('wiki_format_buttons').style.display = v ? 'block' : 'none';
	$('wiki_format_buttons').style.visibility = v ? 'visible' : 'hidden';
}

woas["html_buttons_display"] = function (v) {
	$('html_format_buttons').style.display = v ? 'block' : 'none';
	$('html_format_buttons').style.visibility = v ? 'visible' : 'hidden';
}

// submit by pr0xy

function TextAreaSelectionHelper(obj) {
 this.target=obj;
 this.target.carretHandler=this; // ?
 this.target.onchange=_textareaSaver;
 this.target.onclick=_textareaSaver;
 this.target.onkeyup=_textareaSaver;
 this.target.onfocus=_textareaSaver;
 if(!document.selection) this.target.onSelect=_textareaSaver; // ?
 
 this.start=-1;
 this.end=-1;
 this.scroll=-1;
 this.iesel=null; // ?
}

TextAreaSelectionHelper.prototype.getSelectedText=function() {
  return this.iesel? this.iesel.text: (this.start>=0&&this.end>this.start)? this.target.value.substring(this.start,this.end): "";
}

TextAreaSelectionHelper.prototype.setSelectedText=function(text, secondtag) {
 if(this.iesel) {
if(typeof(secondtag)=="string") {
  var l=this.iesel.text.length;
     this.iesel.text=text+this.iesel.text+secondtag;
  this.iesel.moveEnd("character", -secondtag.length);
   this.iesel.moveStart("character", -l);   
} else {
  this.iesel.text=text;
}
   this.iesel.select();
 } else if(this.start>=0&&this.end>=this.start) {
    var left=this.target.value.substring(0,this.start);
    var right=this.target.value.substr(this.end);
 var scont=this.target.value.substring(this.start, this.end);
 if(typeof(secondtag)=="string") {
   this.target.value=left+text+scont+secondtag+right;
   this.end=this.target.selectionEnd=this.start+text.length+scont.length;
   this.start=this.target.selectionStart=this.start+text.length;    
 } else {
      this.target.value=left+text+right;
   this.end=this.target.selectionEnd=this.start+text.length;
   this.start=this.target.selectionStart=this.start+text.length;
 }
 this.target.scrollTop=this.scroll;
 this.target.focus();
 } else {
   this.target.value+=text + ((typeof(secondtag)=="string")? secondtag: "");
if(this.scroll>=0) this.target.scrollTop=this.scroll;
 }
}

TextAreaSelectionHelper.prototype.getText=function() {
 return this.target.value;
}
TextAreaSelectionHelper.prototype.setText=function(text) {
 this.target.value=text;
}

function _textareaSaver() {
 if(document.selection) {
   this.carretHandler.iesel = document.selection.createRange().duplicate();
 } else if(typeof(this.selectionStart)!="undefined") {
   this.carretHandler.start=this.selectionStart;
this.carretHandler.end=this.selectionEnd;
this.carretHandler.scroll=this.scrollTop;
 } else {this.carretHandler.start=this.carretHandler.end=-1;}
}

function TagThis(starttag, endtag){
	woas._editor.setSelectedText(starttag, endtag);
}

function setUrl(starttag,centerteg,endtag) {
         url=prompt('Link:','http://');
         comm=prompt('Link text:','');
		 woas._editor.setSelectedText(starttag+url+centerteg,comm+endtag);
        }

function setImage(starttag,endtag) {
         pic=prompt('Image:','');
		 woas._editor.setSelectedText(starttag,pic+endtag);
        }

function setTag() {
         tag=prompt('Set tag:','');
         woas._editor.setSelectedText("[[Tag::",tag+"]]");
        }
