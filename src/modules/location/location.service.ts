import { Injectable } from '@nestjs/common';
import { LOCATION_ERRORS } from '../../common/constants';
import { BusinessException } from '../../common/exceptions';
import { HttpStatus } from '@nestjs/common';

const BASE_URL = 'https://provinces.open-api.vn/api/v2';

interface RawProvince {
  code: number;
  name: string;
  codename: string;
  division_type: string;
  phone_code: number;
  wards?: RawWard[];
}

interface RawWard {
  code: number;
  name: string;
  codename: string;
  division_type: string;
  province_code: number;
}

@Injectable()
export class LocationService {
  private mapProvince(p: RawProvince) {
    return {
      code: String(p.code),
      name: p.name,
      nameEn: p.codename,
      fullName: p.name,
    };
  }

  private mapWard(w: RawWard) {
    return {
      code: String(w.code),
      name: w.name,
      nameEn: w.codename,
      fullName: w.name,
      provinceCode: String(w.province_code),
    };
  }

  async getProvinces() {
    const response = await fetch(`${BASE_URL}/p`);
    if (!response.ok) {
      throw new BusinessException(
        LOCATION_ERRORS.LOCATION_FETCH_FAILED,
        HttpStatus.BAD_GATEWAY,
      );
    }
    const data: RawProvince[] = await response.json();
    return data.map((p) => this.mapProvince(p));
  }

  async getProvinceWithWards(provinceCode: number) {
    const response = await fetch(`${BASE_URL}/p/${provinceCode}?depth=2`);
    if (!response.ok) {
      throw new BusinessException(
        LOCATION_ERRORS.LOCATION_PROVINCE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    const data: RawProvince = await response.json();
    return {
      ...this.mapProvince(data),
      wards: (data.wards || []).map((w) => this.mapWard(w)),
    };
  }

  async getWard(wardCode: number) {
    const response = await fetch(`${BASE_URL}/w/${wardCode}`);
    if (!response.ok) {
      throw new BusinessException(
        LOCATION_ERRORS.LOCATION_WARD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    const data: RawWard = await response.json();
    return this.mapWard(data);
  }
}
