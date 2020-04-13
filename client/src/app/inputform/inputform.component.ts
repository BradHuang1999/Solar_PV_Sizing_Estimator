import { ApicallsService } from './../service/apicalls.service';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-inputform',
  templateUrl: './inputform.component.html',
  styleUrls: ['./inputform.component.scss']
})
export class InputformComponent implements OnInit {
  step_1: {
    location_formgroup: FormGroup;
    pv_text_formgroup: FormGroup;
    isUsingLatLon: boolean;
  }

  step_2: {
    pv_params_formgroup: FormGroup;
  }

  step_3: {
    load_text_formgroup: FormGroup;
  }

  step_4: {
    est_params_formgroup: FormGroup;
  }

  validationMsg: string = "";
  resultMsg: string = "";

  constructor(private api: ApicallsService, fb: FormBuilder) {

    this.step_1 = {
      location_formgroup: fb.group({
        lat: [43, Validators.required],
        lon: [-79, Validators.required],
      }),

      pv_text_formgroup: fb.group({
        pv_text: ["", Validators.required],
      }),

      isUsingLatLon: true,
    };

    this.step_2 = {
      pv_params_formgroup: fb.group({
        pv_tilt: [0, Validators.required],
        pv_azimuth: [180, Validators.required],
        pv_module_type: ["0", Validators.required],
        pv_array_type: ["1", Validators.required],
        pv_losses: [14, Validators.required],
      })
    };

    this.step_3 = {
      load_text_formgroup: fb.group({
        load_text: ["", Validators.required]
      })
    };

    this.step_4 = {
      est_params_formgroup: fb.group({
        estimation_type: ["eue", Validators.required],
        pv_price_per_kw: [2000, Validators.required],
        battery_price_per_kwh: [500, Validators.required],
        epsilon_target: [0.05, Validators.required],
        confidence_level: [0.95, Validators.required],
        days_in_sample: [100, Validators.required],
      })
    };
  }

  ngOnInit() {
  }

  step_1_onChangePVInput() {
    this.step_1.isUsingLatLon = !this.step_1.isUsingLatLon;
  }

  step_1_onPVFileChange(files: FileList) {
    let pvFile = files.item(0);

    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      this.step_1.pv_text_formgroup.patchValue({
        pv_text: fileReader.result as string
      })
    }

    fileReader.readAsText(pvFile);
  }

  step_1_lat_lon_onNext() {
    // set tilt to latitude
    let step_1_latitude = this.step_1.location_formgroup.value.lat;
    this.step_2.pv_params_formgroup.patchValue({
      pv_tilt: step_1_latitude
    });
  }

  step_3_onLoadFileChange(files: FileList) {
    let pvFile = files.item(0);

    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      this.step_3.load_text_formgroup.patchValue({
        load_text: fileReader.result as string
      })
    }

    fileReader.readAsText(pvFile);
  }

  onSubmit() {
    this.resultMsg = "Loading...";

    let isUsingLatLon = this.step_1.isUsingLatLon;
    let pv_input_type = isUsingLatLon ? "lat_lon" : "input_file";
    let location_vals = this.step_1.location_formgroup.value;
    let pv_text_vals = this.step_1.pv_text_formgroup.value;
    let pv_params_vals = this.step_2.pv_params_formgroup.value;
    let load_text_vals = this.step_3.load_text_formgroup.value;
    let est_params_vals = this.step_4.est_params_formgroup.value;

    let requestBody: any = {};

    if (isUsingLatLon) {
      requestBody.lat = location_vals.lat;
      requestBody.lon = location_vals.lon;
    } else {
      requestBody.pv_text = pv_text_vals.pv_text;
    }

    requestBody.pv_input_type = pv_input_type;
    
    requestBody.pv_tilt = pv_params_vals.pv_tilt;
    requestBody.pv_azimuth = pv_params_vals.pv_azimuth;
    requestBody.pv_module_type = pv_params_vals.pv_module_type;
    requestBody.pv_array_type = pv_params_vals.pv_array_type;
    requestBody.pv_losses = pv_params_vals.pv_losses;
 
    requestBody.load_text = load_text_vals.load_text;

    requestBody.estimation_type = est_params_vals.estimation_type;
    requestBody.pv_price_per_kw = est_params_vals.pv_price_per_kw;
    requestBody.battery_price_per_kwh = est_params_vals.battery_price_per_kwh;
    requestBody.epsilon_target = est_params_vals.epsilon_target;
    requestBody.confidence_level = est_params_vals.confidence_level;
    requestBody.days_in_sample = est_params_vals.days_in_sample;

    console.log(requestBody);

    this.api
      .postData(requestBody)
      .subscribe(res => {
        this.resultMsg = JSON.stringify(res, null, 2);
      });
  }
}
