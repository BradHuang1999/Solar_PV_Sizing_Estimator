import { ApicallsService } from './../service/apicalls.service';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormConfig, RxwebValidators } from '@rxweb/reactive-form-validators';


@Component({
  selector: 'app-inputform',
  templateUrl: './inputform.component.html',
  styleUrls: ['./inputform.component.scss']
})
export class InputformComponent implements OnInit {
  inputForm: FormGroup;
  validationMsg: string = "";
  resultMsg: string = "";

  constructor(private api: ApicallsService, fb: FormBuilder) {
    this.inputForm = fb.group({
      estimation_type: ["eue", Validators.required],
      pv_price_per_kw: [2000, Validators.required],
      battery_price_per_kwh: [500, Validators.required],
      epsilon_target: [0.05, Validators.required],
      confidence_level: [0.95, Validators.required],
      days_in_sample: [100, Validators.required],
      pv_input_type: ["input_file", Validators.required],
      lat: [43],
      lon: [-79],
      load_text: ["", Validators.required],
      pv_text: [""],
    })
  }

  ngOnInit() {
  }

  onLoadFileChange(files: FileList) {
    let loadFile = files.item(0);

    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      this.inputForm.patchValue({
        load_text: fileReader.result as string
      })
    }

    fileReader.readAsText(loadFile);
  }

  onPVFileChange(files: FileList) {
    let pvFile = files.item(0);

    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      this.inputForm.patchValue({
        pv_text: fileReader.result as string
      })
    }

    fileReader.readAsText(pvFile);
  }

  submit() {
    this.validationMsg = "";

    this.inputForm.updateValueAndValidity();
    if (!this.inputForm.valid) {
      console.log(this.inputForm.errors);
      console.log(this.inputForm.value);
      this.validationMsg = "Please fill in the required fields"
      return;
    }

    let requrestBody = this.inputForm.value;

    console.log(requrestBody);

    this.resultMsg = "Loading...";

    this.api
      .postData(requrestBody)
      .subscribe(res => {
        this.resultMsg = JSON.stringify(res, null, 2);
      });
  }
}
