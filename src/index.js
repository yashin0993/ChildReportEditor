let socket = null;

let childList = null;
let monthList = null;
let saveTextButton = null;
let monthCreateButton = null;
let addChildButton = null;
let addChildDoButton = null;
let addChildCancelButton = null;
let currentTextArea = null;
let previousTextArea = null;
let exportButton = null;
let autoDownload = true;

function onloaded() {
    socket = io.connect("http://localhost:9000");
    childList = document.querySelector("#select_child");
    monthList = document.querySelector("#select_month");
    saveTextButton = document.querySelector("#save_btn");
    monthCreateButton = document.querySelector("#month_create_btn");
    addChildButton = document.querySelector("#add_child");
    addChildDoButton = document.querySelector("#add_child_btn");
    addChildCancelButton = document.querySelector("#add_cancel_btn");
    currentTextArea = document.querySelector("#current_report");
    previousTextArea = document.querySelector("#previous_report");
    exportButton = document.querySelector("#export_btn");

    socket.on("connect", () => {
        console.log("connected");
        socket.emit("month");
        socket.emit("children");
    });

    socket.on("month_list", data => {
        monthList.innerHTML = "";
        data.sort((a,b) => {
                let aa = Number(a.year + a.month);
                let bb = Number(b.year + b.month);
                return aa > bb ? -1 : aa < bb ? 1 : 0;
            })
            .forEach(d => {
                monthList.innerHTML += "<option id='" + d.year + "_" + d.month + "'>" + d.year + "年" + d.month + "月" + "</option>";
            });
        
        if(-1 < childList.selectedIndex && -1 < monthList.selectedIndex) {
            getReport();
        }
    });

    socket.on("children_list", data => {
        childList.innerHTML = "";
        data.child
            .sort((a,b) => a < b ? -1 : a > b ? 1 : 0 )
            .forEach(d => {
                childList.innerHTML += "<option id='" + d.id + "'>" + d.name + "</option>";
            });

        if(-1 < childList.selectedIndex && -1 < monthList.selectedIndex) {
            getReport();
        }
    });

    socket.on("text_contents", data => {

        currentTextArea.value = "";
        if(data.current.is_exist){
            currentTextArea.value = data.current.text;
            let date = new Date().toLocaleString({ timeZone: 'Asia/Tokyo' }).split(" ")[0].split("/");
            let year = date[0];
            let month = date[1];
            if(Number(year) <= Number(data.current.date.year) &&
                Number(month) <= Number(data.current.date.month) ){
                currentTextArea.readOnly = false;
            } else {
                currentTextArea.readOnly = true;
            }
        }

        previousTextArea.value = "";
        if(data.previous.is_exist){
            previousTextArea.value = data.previous.text;
        }
    });

    socket.on("saved", result => {
        if(!result){
            alert("保存に失敗しました。");
        } else {
            alert("保存完了！");
        }
    });

    socket.on("add_child_result", data => {
        if(!data){
            alert("登録に失敗しました。");
        } else {
            childList.innerHTML = "";
            data.child.forEach(d => {
                    childList.innerHTML += "<option id='" + d.id + "'>" + d.name + "</option>";
                });
            alert("登録完了！");
            document.querySelector("#add_dialog").className = "hidden";
        }
    });

    socket.on("exported", result => {
        if(!result){
            alert("出力に失敗しました。");
        } else {
            alert("出力完了！");
            if(autoDownload){
                downloadFile();
            }
        }
    });

    // MonthList onstatechange
    monthList.onchange = () => {
        getReport();
    }

    // childList onstatechange
    childList.onchange = () => {
        getReport();
    }

    addChildButton.onclick = () => {
        document.querySelector("#add_dialog").className = "show";
    };

    addChildDoButton.onclick = () => {
        let name = document.querySelector("#add_name").value;
        if(name == "") { alert("名前を入力して下さい。"); return; }
        let id = document.querySelector("#add_id").value;
        if(id == "") { alert("IDを入力して下さい。"); return; }
        let age = document.querySelector("#add_age").value;
        if(age == "") { alert("年齢を入力して下さい。"); return; }
        let sex = document.querySelector("#add_sex").selectedIndex;
        if(sex == 0) {alert("性別を選択して下さい"); return; }
        socket.emit("add_child", {name:name, id:id, age:Number(age), sex:sex - 1});
    };

    addChildCancelButton.onclick = () => {
        document.querySelector("#add_name").value = "";
        document.querySelector("#add_id").value = "";
        document.querySelector("#add_age").value = "";
        document.querySelector("#add_sex").selectedIndex = 0;
        document.querySelector("#add_dialog").className = "hidden";
    }

    saveTextButton.onclick = () => {
        if(childList.selectedIndex < 0) { 
            alert("園児を選択してください。");
            return;
        }
        if(monthList.selectedIndex < 0) {
            alert("月を選択して下さい。");
            return;
        }

        let childId = childList.selectedOptions[0].id;
        let selectedDate = getSelectedDate();
        let postData = {
            child_id : childId,
            date : {year: selectedDate.year, month: selectedDate.month},
            text : currentTextArea.value
        };
        socket.emit("save_text", postData);
    }

    exportButton.onclick = () => {
        let date = getSelectedDate();
        console.log(date);
        socket.emit("export", date);
    };
}

function getReport(){
    let childId = childList.selectedOptions[0].id;
    let selectedDate = monthList.selectedOptions[0].id.split("_");
    let postData = {
        child_id : childId,
        date : {year: selectedDate[0], month: selectedDate[1]}
    };
    socket.emit("get_text", postData);
}

function getSelectedDate(){
    let selectedDate = monthList.selectedOptions[0].id.split("_");
    return { year: selectedDate[0], month: selectedDate[1]};
}

function downloadFile(){
    let date = getSelectedDate();
    fetch(`${location.href}download?year=${date.year}&month=${date.month}`)
    .then(res => {
        if(!res.ok){

        }else {
            return res.blob();
        }
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.download = `report_${date.year}_${date.month}.pdf`;
        a.href = url;
        a.click();
        a.remove();
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1E4);
    });
}