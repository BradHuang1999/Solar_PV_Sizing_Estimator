import { ApicallsService } from './../service/apicalls.service';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';

@Component({
  selector: 'app-inputform',
  templateUrl: './inputform.component.html',
  styleUrls: ['./inputform.component.scss']
})
export class InputformComponent implements OnInit {
  step_1: {
    address_formgroup: FormGroup;
    location_formgroup: FormGroup;
    pv_text_formgroup: FormGroup;
    isUsingPVEstimation: boolean;
    errorMsg: string;
  }

  step_2: {
    pv_params_formgroup: FormGroup;
  }

  step_3: {
    load_estimation_formgroup: FormGroup;
    load_text_formgroup: FormGroup;
    isUsingLoadEstimation: boolean;
  }

  step_4: {
    est_params_formgroup: FormGroup;
  }

  validationMsg: string = "";
  resultMsg: string = "";

  months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  load_monthly_examples = [341, 271.6, 244.9, 249, 189.1, 186, 176.7, 195.3, 222, 272.8, 294, 340]

  constructor(private api: ApicallsService, fb: FormBuilder) {

    this.step_1 = {
      address_formgroup: fb.group({
        city: [""]
      }),

      location_formgroup: fb.group({
        lat: [43, [Validators.required, Validators.min(-90), Validators.max(90)]],
        lon: [-79, [Validators.required, Validators.min(-180), Validators.max(180)]],
      }),

      pv_text_formgroup: fb.group({
        pv_text: ["", Validators.required],
      }),

      isUsingPVEstimation: true,

      errorMsg: ""
    };

    this.step_2 = {
      pv_params_formgroup: fb.group({
        pv_tilt: [0, [Validators.required, Validators.min(0), Validators.max(90)]],
        pv_azimuth: [180, [Validators.required, Validators.min(0), Validators.max(360)]],
        pv_module_type: ["0", Validators.required],
        pv_array_type: ["1", Validators.required],
        pv_losses: [14, [Validators.required, Validators.min(0), Validators.max(99)]],
      })
    };

    this.step_3 = {
      load_estimation_formgroup: fb.group({
        load_monthly: fb.array(this.load_monthly_examples.map(m => new FormControl(m, [Validators.required, Validators.min(0)])))
      }),

      load_text_formgroup: fb.group({
        load_text: ["", Validators.required]
      }),

      isUsingLoadEstimation: true
    };

    this.step_4 = {
      est_params_formgroup: fb.group({
        estimation_type: ["eue", Validators.required],
        pv_price_per_kw: [2000, [Validators.required, Validators.min(0)]],
        battery_price_per_kwh: [500, [Validators.required, Validators.min(0)]],
        confidence_level: [0.95, [Validators.required, Validators.min(0.5), Validators.max(1)]],
        days_in_sample: [100, [Validators.required, Validators.min(0)]],
      })
    };
  }

  ngOnInit() {
  }

  id(i) {
    return i;
  }

  step_1_inferLocationUsingIP() {
    try {
      this.api.getLocationFromIP()
          .subscribe(ipLocation => {
            if (ipLocation.success) {
              this.step_1.address_formgroup.patchValue({
                city: `${ipLocation.data.city}, ${ipLocation.data.region}, ${ipLocation.data.country}`
              });
              this.step_1.location_formgroup.patchValue({
                lat: ipLocation.data.lat,
                lon: ipLocation.data.lon
              });
            } else {
              throw "IP Location Detection Failed. Please try autofill your location using your city or manually enter lat/lon."
            }
          });
    } catch (err) {
      this.step_1.errorMsg = err;
    }
  }

  step_1_inferLocationUsingAddress(address: string) {
    let addr: string = this.step_1.address_formgroup.value.city;
    try {
      this.api.getLocationFromAddress(addr)
          .subscribe(addrLocation => {
            if (addrLocation.success) {
              let loc = addrLocation.data[0];
              this.step_1.location_formgroup.patchValue({
                lat: loc.latLng.lat,
                lon: loc.latLng.lng
              });
            } else {
              throw "Location Detection Failed. Please try autofill your location using your IP or manually enter lat/lon."
            }
          });
    } catch (err) {
      this.step_1.errorMsg = err;
    }
  }

  step_1_onChangePVInput() {
    this.step_1.isUsingPVEstimation = !this.step_1.isUsingPVEstimation;
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
      pv_tilt: Math.abs(step_1_latitude)
    });
  }

  step_3_onChangeLoadInput() {
    this.step_3.isUsingLoadEstimation = !this.step_3.isUsingLoadEstimation;
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

    let requestBody: any = {
      pv: {
        isUsingPVEstimation: this.step_1.isUsingPVEstimation,
        pv_text: this.step_1.pv_text_formgroup.value.pv_text,
        pv_params: {...this.step_1.location_formgroup.value, ...this.step_2.pv_params_formgroup.value}
      },
      load: {
        isUsingLoadEstimation: this.step_3.isUsingLoadEstimation,
        load_text: this.step_3.load_text_formgroup.value.load_text,
        load_monthly_params: this.step_3.load_estimation_formgroup.value.load_monthly
      },
      sizing: this.step_4.est_params_formgroup.value
    }

    console.log(requestBody);

    this.api
      .getPVSize(requestBody)
      .subscribe(res => {
        this.resultMsg = JSON.stringify(res, null, 2);
      });
  }
}
