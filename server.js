'use strict'

const fs          = require("fs");
const path        = require("path");
const express     = require("express");
const http        = require("http");
const bodyParser  = require("body-parser");
const socketio    = require("socket.io");
const markdownpdf = require("markdown-pdf");
const mime        = require('mime');

// Global変数
let PORT           = 9000;
let CHILDREN_LIST  = __dirname + "/db/children.json";
let DATA_ROOT_PATH = __dirname + "/db/data";
let EXPORT_PATH    = __dirname + "/export";
let APP            = express();
let SERVER         = http.createServer(APP);
let IO             = socketio.listen(SERVER);

// サーバー環境設定
APP.set('port', PORT);
APP.use('/', express.static(__dirname + '/view/html'));
APP.use('/modules', express.static(__dirname + '/node_modules'));
APP.use('/src', express.static(__dirname + '/src'));
APP.use('/css', express.static(__dirname + '/view/css'));
APP.use(bodyParser.urlencoded({ extended: true }));
APP.use(bodyParser.json());
APP.get("/download", (req, res) => {
    let file = __dirname + `/export/${req.query.year}_${req.query.month}_report.pdf`;
    let filename = path.basename(file);
    res.download(file, filename);
});

// フォルダ、ファイルのチェック
fs.stat(DATA_ROOT_PATH, (err, stat) => {
    if(err){
        fs.mkdirSync(DATA_ROOT_PATH, {recursive : true});
    }
});
fs.stat(EXPORT_PATH, (err, stat) => {
    if(err){
        fs.mkdirSync(EXPORT_PATH, {recursive : true});
    }
});
fs.stat(CHILDREN_LIST, (err, stat) => {
    if(err){
        fs.writeFile(CHILDREN_LIST, `{"child":[]}`, err => {
            if(err) { console.log("Failed to create children list."); }
            else { console.log("child list created."); }
        });
    }
});

// サーバー起動
SERVER.listen(APP.get('port'), function(){
    console.log('Express server listening on port ' + APP.get('port'));
});

// Clientが接続してきたらCallbackをセット
IO.sockets.on("connection", socket => {
    console.log("socket connected");

    // 今月分のフォルダができていなければ作成
    fs.readdir(DATA_ROOT_PATH, 'utf-8', (err, names) => {
        if(err) { console.log("no_dirs"); } 
        else {
            // 今月を取得
            let date = new Date();
            let today = date.getFullYear() + "_" + ("0" + (date.getMonth()+1)).slice(-2);
            console.log("today : " + today);
            
            if(names.length == 0){
                fs.mkdir(path.join(DATA_ROOT_PATH, today),err =>{
                    if(err) {console.log("mkdir failed : " + today);}
                    else {console.log("mkdir " + today);}
                });
            } else {
                let latest = names.sort((a, b) => a < b ? 1 : a > b ? -1 : 0)[0];
                let latest_num = Number(latest.replace("_", ""));
                let today_num = Number(today.replace("_", ""));
                if(latest_num < today_num){
                    fs.mkdir(path.join(DATA_ROOT_PATH, today),err =>{
                        if(err) {console.log("mkdir failed : " + today);}
                        else {console.log("mkdir " + today);}
                    });
                }
                console.log("latest : " + latest_num + ", today : " + today_num);
            }
            
            
            
        }
    });

    // 子供リスト要求
    socket.on("children", () => {
        fs.readFile(CHILDREN_LIST, 'utf-8', (err, data) => {
            if(err) { 
                IO.sockets.emit("children_list", null);
            } else {
                if(data == ""){
                    data = '{"child" : []}';
                }
                let jdata = JSON.parse(data);
                console.log(jdata);
                IO.sockets.emit("children_list", jdata);
            }
        });
    });

    // 月取得要求
    socket.on("month", () => {
        fs.readdir(DATA_ROOT_PATH, 'utf-8', (err, names) => {
            if(err) { 
                IO.sockets.emit("month_list", null);
            } else {
                console.log(names);
                let res = names.map(d => {
                                let date_arr = d.split("_");
                                return {"year": date_arr[0], "month": date_arr[1]};
                            });
                console.log(res);
                IO.sockets.emit("month_list", res);
            }
        });
    });

    // 園児登録要求
    socket.on("add_child", child_data => {
        console.log(child_data);
        fs.readFile(CHILDREN_LIST, 'utf-8', (err, data) => {
            if(err) { 
                IO.sockets.emit("add_child_result", false);
            } else {
                if(data == ""){
                    data = '{"child" : []}';
                }
                let jdata = JSON.parse(data);
                console.log(jdata);
                jdata.child.push(child_data);
                fs.writeFile(CHILDREN_LIST, JSON.stringify(jdata), 'utf-8', err => {
                    if(err) IO.sockets.emit("add_child_result", false);
                    else IO.sockets.emit("add_child_result", jdata); 
                });
            }
        }); 
    });

    // 編集テキスト取得要求
    socket.on("get_text", data => {
        console.log("get_text");
        let curr_date = data.date;
        let prev_date = calcPreviousDate(data.date);
        console.log("current : ");
        console.log(curr_date);
        console.log("previous : ");
        console.log(prev_date);
        let curr_date_str = curr_date.year + "_" + curr_date.month;
        let prev_date_str = prev_date.year + "_" + prev_date.month;
        let child_id = data.child_id;
        let curr_read_path = path.join(DATA_ROOT_PATH, curr_date_str, curr_date_str + "_" + child_id + ".log");
        let prev_read_path = path.join(DATA_ROOT_PATH, prev_date_str, prev_date_str + "_" + child_id + ".log");
        let res = {
            current : { is_exist: false, text: "", date : curr_date },
            previous: { is_exist: false, text: "", date : prev_date }
        };
        fs.readFile(curr_read_path, 'utf-8', (err, data) => {
            if(err) {
                res.current.is_exist = false;
                res.current.text = "";
            } else {
                res.current.is_exist = true;
                res.current.text = data;
            }
            fs.readFile(prev_read_path, 'utf-8', (err, data) => {
                if(err) {
                    res.previous.is_exist = false;
                    res.previous.text = "";
                } else {
                    res.previous.is_exist = true;
                    res.previous.text = data;
                }
                console.log(res);
                IO.sockets.emit("text_contents", res);
            });
        });
    });

    // 編集内容保存要求
    socket.on("save_text", data => {
        console.log("get_text");
        let curr_date = data.date;
        let curr_date_str = curr_date.year + "_" + curr_date.month;
        let child_id = data.child_id;
        let save_date_dir = path.join(DATA_ROOT_PATH, curr_date_str);
        let save_path = path.join(save_date_dir, curr_date_str + "_" + child_id + ".log");
        fs.stat(save_date_dir, (err, stat) => {
            if(err){
                fs.mkdirSync(save_date_dir);
            }
            fs.writeFile(save_path, data.text, (err) => {
                if(err){
                    IO.sockets.emit("saved", false);
                } else {
                    IO.sockets.emit("saved", true);
                }
            });
        });
    });

    socket.on("export", (_date) => {
        // let date = new Date();
        // let today = date.getFullYear() + "_" + ("0" + (date.getMonth()+1)).slice(-2);
        console.log("date:\n");
        console.log(_date);
        let target_date = _date.year + "_" + _date.month;
        let target_path = path.join(DATA_ROOT_PATH, target_date);
        
        //子供リスト取得
        let child_list = JSON.parse(fs.readFileSync(CHILDREN_LIST, 'utf-8'));
        let child_dict = new Object();
        child_list.child.forEach(d => { child_dict[d.id] = d.name; });
        
        let texts = fs.readdirSync(target_path, "utf-8")
            .map(file => {
                let id = path.basename(file,  path.extname(file)).split("_")[2];
                return {
                    name : child_dict[id],
                    text : fs.readFileSync(path.join(target_path, file), 'utf-8')
                };
            });
        
        let export_text = "";
        texts.forEach(d => {
            export_text += ("# " + d.name + "\n```\n");
            export_text += (d.text + "\n```\n\n");
        });
        let pdf_path = path.join(EXPORT_PATH, target_date + "_report.pdf");
        // md -> pdf
        markdownpdf()
            .from.string(export_text)
            .to(pdf_path, () => {
                IO.sockets.emit("exported", true);
            });
    });
});

function calcPreviousDate(date){
    let year = Number(date.year);
    let month = Number(date.month);
    if(month == 1){ 
        year--;
        month = 12;
    } else {
        month--;
    }
    return {year: String(year), month: ( month < 10 ) ? "0" + String(month) : String(month)};
}